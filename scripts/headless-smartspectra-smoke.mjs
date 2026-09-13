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
    if (process.env[key]) continue;
    process.env[key] = rawValue.replace(/^['"]|['"]$/g, "");
  }
}

loadDotEnv();

const videoPath = process.argv[2] ?? "./test-assets/face.mp4";

if (!process.env.SMARTSPECTRA_API_KEY) {
  console.error("FAIL: SMARTSPECTRA_API_KEY is not set.");
  process.exit(1);
}

if (!existsSync(videoPath)) {
  console.error(`FAIL: video file not found: ${videoPath}`);
  console.error("Add a 30-60 second, well-lit face clip or pass a path argument.");
  process.exit(1);
}

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

const LOG_LEVELS = {
  debug: SmartSpectraLogLevel?.kDebug,
  info: SmartSpectraLogLevel?.kInfo,
  warning: SmartSpectraLogLevel?.kWarning,
  error: SmartSpectraLogLevel?.kError,
  none: SmartSpectraLogLevel?.kNone,
};
const logLevel =
  LOG_LEVELS[(process.env.SMARTSPECTRA_LOG_LEVEL ?? "warning").toLowerCase()] ??
  SmartSpectraLogLevel?.kWarning;
const includeFace = process.env.SMARTSPECTRA_FACE_METRICS === "1";
const waitTimeoutMs = Number(process.env.SMARTSPECTRA_SMOKE_TIMEOUT_MS ?? 120000);
const maxDurationMs = Number(process.env.SMARTSPECTRA_SMOKE_MAX_DURATION_MS ?? 0);
const interframeDelayMs = Number(
  process.env.SMARTSPECTRA_SMOKE_INTERFRAME_DELAY_MS ?? 0,
);

const sdk = new SmartSpectraSDK({
  apiKey: process.env.SMARTSPECTRA_API_KEY,
  requestedMetrics: [
    ...breathingMetrics,
    ...cardioMetrics,
    ...(includeFace && faceMetrics ? faceMetrics : []),
  ],
  enableAccumulatedOutput: true,
  enableTelemetry: process.env.SMARTSPECTRA_ENABLE_TELEMETRY !== "0",
  logLevel,
});

let sawPulse = false;
let sawBreathing = false;
let metricPackets = 0;
let accumulatedPackets = 0;
let lastPulse;
let lastBreathing;
let pressureSamples = 0;
let hrvSamples = 0;
let faceSamples = 0;

sdk.on("metrics", (buf) => {
  metricPackets += 1;
  const metrics = decodeMetrics(buf);

  const pulse = metrics.cardio?.pulseRate?.at(-1)?.value;
  const breathing = metrics.breathing?.rate?.at(-1)?.value;
  pressureSamples += metrics.cardio?.arterialPressureTrace?.length ?? 0;
  hrvSamples += metrics.cardio?.hrv?.length ?? 0;
  faceSamples +=
    (metrics.face?.landmarks?.length ?? 0) +
    (metrics.face?.blinking?.length ?? 0) +
    (metrics.face?.talking?.length ?? 0) +
    (metrics.face?.expression?.length ?? 0);

  if (pulse != null) {
    sawPulse = true;
    lastPulse = pulse;
  }
  if (breathing != null) {
    sawBreathing = true;
    lastBreathing = breathing;
  }
});

sdk.on("accumulatedMetrics", () => {
  accumulatedPackets += 1;
});

sdk.on("validationStatus", (code, _timestampUs, hint) => {
  if (hint) console.log(`validation ${code}: ${hint}`);
});

sdk.on("error", (code, message, retryable) => {
  console.error(`SmartSpectra error ${code}: ${message} (retryable=${retryable})`);
  process.exitCode = 1;
});

const settled = new Promise((resolve) => {
  let started = false;
  sdk.on("processingStatus", (status) => {
    console.log(`processingStatus=${status}`);
    if (status === ProcessingStatus.kRunning) started = true;
    if (
      started &&
      (status === ProcessingStatus.kIdle || status === ProcessingStatus.kError)
    ) {
      resolve();
    }
  });
});

console.log(`SmartSpectra headless smoke: ${videoPath}`);
sdk.useFile(videoPath, {
  maxDurationMs: Number.isFinite(maxDurationMs) ? maxDurationMs : 0,
  interframeDelayMs: Number.isFinite(interframeDelayMs) ? interframeDelayMs : 0,
});

try {
  sdk.start();
  if (Number.isFinite(waitTimeoutMs) && waitTimeoutMs > 0) {
    const timeout = new Promise((_, reject) => {
      setTimeout(
        () => reject(new Error(`Timed out after ${waitTimeoutMs}ms`)),
        waitTimeoutMs,
      );
    });
    await Promise.race([settled, timeout]);
  } else {
    await settled;
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await sdk.destroy();
}

if (process.exitCode) process.exit(process.exitCode);

if (!sawPulse || !sawBreathing) {
  console.error(
    `FAIL: missing readings. packets=${metricPackets} pulse=${sawPulse} breathing=${sawBreathing}`,
  );
  process.exit(1);
}

console.log(
  [
    "OK: readings appeared.",
    `packets=${metricPackets}`,
    `accumulated=${accumulatedPackets}`,
    `pulse=${lastPulse?.toFixed?.(0) ?? "seen"}`,
    `breathing=${lastBreathing?.toFixed?.(0) ?? "seen"}`,
    `pressureSamples=${pressureSamples}`,
    `hrvSamples=${hrvSamples}`,
    `faceSamples=${faceSamples}`,
  ].join(" "),
);
