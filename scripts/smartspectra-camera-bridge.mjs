#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";

function loadDotEnv(path = ".env") {
  if (!existsSync(path)) return;
  const lines = readFileSync(path, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(trimmed);
    if (!match) continue;
    const [, key, rawValue] = match;
    const value = rawValue.replace(/^['"]|['"]$/g, "");
    if (key === "SMARTSPECTRA_API_KEY" && value) {
      process.env[key] = value;
      continue;
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

function last(items) {
  return items?.at(-1);
}

function number(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function validationLabel(code, hint) {
  if (hint) return hint;
  return code === 0 ? "OK" : `Validation ${code}`;
}

loadDotEnv();

if (!process.env.SMARTSPECTRA_API_KEY) {
  console.error("FAIL: SMARTSPECTRA_API_KEY is not set.");
  process.exit(1);
}

const platformUrl = (
  process.env.SMARTSPECTRA_BRIDGE_PLATFORM_URL ??
  process.env.CAREFALL_PLATFORM_URL ??
  "http://localhost:3000"
).replace(/\/$/, "");
const sessionId = process.env.SMARTSPECTRA_BRIDGE_SESSION_ID ?? "mac-camera";
const durationMs = Number(process.env.SMARTSPECTRA_BRIDGE_DURATION_MS ?? 0);

let sdkModule;
let messagesModule;

try {
  sdkModule = await import("@smartspectra/node-sdk");
  messagesModule = await import("@smartspectra/node-sdk/messages");
} catch (error) {
  console.error("FAIL: @smartspectra/node-sdk could not be loaded.");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

const {
  SmartSpectraSDK,
  ProcessingStatus,
  SmartSpectraLogLevel,
  breathingMetrics,
  cardioMetrics,
  faceMetrics,
} = sdkModule;
const { decodeMetrics } = messagesModule;

const sdk = new SmartSpectraSDK({
  apiKey: process.env.SMARTSPECTRA_API_KEY,
  requestedMetrics: [
    ...breathingMetrics,
    ...cardioMetrics,
    ...(process.env.SMARTSPECTRA_FACE_METRICS === "1" && faceMetrics ? faceMetrics : []),
  ],
  enableAccumulatedOutput: true,
  enableTelemetry: process.env.SMARTSPECTRA_ENABLE_TELEMETRY !== "0",
  logLevel:
    SmartSpectraLogLevel?.[
      `k${(process.env.SMARTSPECTRA_LOG_LEVEL ?? "Warning")
        .toLowerCase()
        .replace(/^\w/, (letter) => letter.toUpperCase())}`
    ] ?? SmartSpectraLogLevel?.kWarning,
});

let packets = 0;
let latestVitals = {};
let latestValidation = { code: "waiting", label: "Waiting" };
let latestProcessingStatus = "not-started";
let stopping = false;
let lastPostAt = 0;

async function postVitals(force = false) {
  const now = Date.now();
  if (!force && now - lastPostAt < 1000) return;
  if (!latestVitals.pulse && !latestVitals.respiration && !latestVitals.pressureWaveform) return;

  lastPostAt = now;
  const response = await fetch(
    `${platformUrl}/api/mobile-health/${encodeURIComponent(sessionId)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        vitals: latestVitals,
        source: "node-camera",
        cameraFacing: "front",
        processingStatus: latestProcessingStatus,
        validation: latestValidation,
        capturedAt: now,
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`POST /api/mobile-health/${sessionId} failed with ${response.status}`);
  }
}

sdk.on("processingStatus", (status) => {
  latestProcessingStatus = `${status}`;
  console.log(`processingStatus=${status}`);
});

sdk.on("validationStatus", (code, _timestampUs, hint) => {
  latestValidation = {
    code: `${code}`,
    label: validationLabel(code, hint),
  };
  if (hint) console.log(`validation ${code}: ${hint}`);
});

sdk.on("metrics", (buf) => {
  packets += 1;
  const metrics = decodeMetrics(buf);
  const pulse = number(last(metrics.cardio?.pulseRate)?.value);
  const respiration = number(last(metrics.breathing?.rate)?.value);
  const pressureWaveform = metrics.cardio?.arterialPressureTrace
    ?.map((sample) => number(sample.value))
    .filter((value) => value !== undefined);
  const hrv = last(metrics.cardio?.hrv);
  const expression = last(metrics.face?.expression);

  latestVitals = {
    ...latestVitals,
    pulse: pulse ? Math.round(pulse) : latestVitals.pulse,
    respiration: respiration ? Math.round(respiration) : latestVitals.respiration,
    signalQuality: latestValidation.code === "0" ? "GOOD" : latestValidation.label,
    pressureWaveform:
      pressureWaveform && pressureWaveform.length > 0
        ? pressureWaveform
        : latestVitals.pressureWaveform,
    hrv: hrv
      ? {
          rmssd: number(hrv.rmssd),
          meanNn: number(hrv.meanNn),
          sdnn: number(hrv.sdnn),
          baevsky: number(hrv.baevsky),
          confidence: number(hrv.confidence),
          stable: hrv.stable,
        }
      : latestVitals.hrv,
    face: expression
      ? {
          expression:
            expression.value ?? expression.label ?? expression.expression ?? "READY",
        }
      : latestVitals.face,
    packets,
  };

  void postVitals().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
  });

  if (pulse != null || respiration != null || packets % 60 === 0) {
    console.log(
      [
        `session=${sessionId}`,
        `packets=${packets}`,
        `pulse=${latestVitals.pulse ?? "--"}`,
        `respiration=${latestVitals.respiration ?? "--"}`,
        `pressureSamples=${latestVitals.pressureWaveform?.length ?? 0}`,
        `hrv=${latestVitals.hrv?.rmssd?.toFixed?.(1) ?? "--"}`,
      ].join(" "),
    );
  }
});

sdk.on("error", (code, message, retryable) => {
  if (stopping && code === 1) return;
  console.error(`SmartSpectra error ${code}: ${message} (retryable=${retryable})`);
  process.exitCode = 1;
});

async function stop() {
  if (stopping) return;
  stopping = true;
  try {
    await postVitals(true);
  } catch {
    // Best effort final publish.
  }
  try {
    await sdk.stopAsync();
  } catch {
    sdk.stop();
  }
  await sdk.destroy();
}

process.on("SIGINT", async () => {
  await stop();
  process.exit(process.exitCode ?? 0);
});
process.on("SIGTERM", async () => {
  await stop();
  process.exit(process.exitCode ?? 0);
});

console.log("SmartSpectra camera bridge");
console.log(`platform=${platformUrl}`);
console.log(`session=${sessionId}`);
console.log(`durationMs=${durationMs || "until Ctrl+C"}`);
console.log("Keep face and upper chest visible. Start the Next app before this bridge.");

try {
  sdk.useCamera({
    deviceIndex: Number(process.env.SMARTSPECTRA_CAMERA_INDEX ?? 0),
    width: Number(process.env.SMARTSPECTRA_CAMERA_WIDTH ?? 1280),
    height: Number(process.env.SMARTSPECTRA_CAMERA_HEIGHT ?? 720),
    fps: Number(process.env.SMARTSPECTRA_CAMERA_FPS ?? 30),
  });
  sdk.start();

  if (Number.isFinite(durationMs) && durationMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, durationMs));
    await stop();
  } else {
    await new Promise(() => {});
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
  await stop();
  process.exit(process.exitCode);
}
