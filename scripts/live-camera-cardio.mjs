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

if (!process.env.SMARTSPECTRA_API_KEY) {
  console.error("FAIL: SMARTSPECTRA_API_KEY is not set.");
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

const durationMs = Number(process.env.SMARTSPECTRA_CAMERA_TEST_MS ?? 90000);
const includeFace = process.env.SMARTSPECTRA_FACE_METRICS === "1";

const sdk = new SmartSpectraSDK({
  apiKey: process.env.SMARTSPECTRA_API_KEY,
  requestedMetrics: [
    ...breathingMetrics,
    ...cardioMetrics,
    ...(includeFace && faceMetrics ? faceMetrics : []),
  ],
  enableAccumulatedOutput: true,
  enableTelemetry: process.env.SMARTSPECTRA_ENABLE_TELEMETRY !== "0",
  logLevel: SmartSpectraLogLevel?.kInfo,
});

let metricPackets = 0;
let lastPulse;
let lastBreathing;
let pressureSamples = 0;
let hrvSamples = 0;
let faceSamples = 0;
let sawPulse = false;
let sawBreathing = false;
let statusText = "not-started";
let stopping = false;
let lastValidation = "";

sdk.on("processingStatus", (status) => {
  statusText = `${status}`;
  console.log(`processingStatus=${status}`);
});

sdk.on("validationStatus", (code, _timestampUs, hint) => {
  const next = `${code}:${hint ?? ""}`;
  if (hint && next !== lastValidation) {
    console.log(`validation ${code}: ${hint}`);
    lastValidation = next;
  }
});

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

  if (metricPackets % 15 === 0 || pulse != null || breathing != null) {
    console.log(
      [
        `packets=${metricPackets}`,
        `pulse=${pulse?.toFixed?.(0) ?? "--"}`,
        `breathing=${breathing?.toFixed?.(0) ?? "--"}`,
        `pressureSamples=${pressureSamples}`,
        `hrvSamples=${hrvSamples}`,
      ].join(" "),
    );
  }
});

sdk.on("error", (code, message, retryable) => {
  if (stopping && code === 1) return;
  console.error(`SmartSpectra error ${code}: ${message} (retryable=${retryable})`);
  process.exitCode = 1;
});

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

console.log("SmartSpectra live camera cardio test");
console.log(`durationMs=${durationMs}`);
console.log("Look at the Mac camera. Keep face and upper chest visible.");

try {
  sdk.useCamera({
    deviceIndex: Number(process.env.SMARTSPECTRA_CAMERA_INDEX ?? 0),
    width: Number(process.env.SMARTSPECTRA_CAMERA_WIDTH ?? 1280),
    height: Number(process.env.SMARTSPECTRA_CAMERA_HEIGHT ?? 720),
    fps: Number(process.env.SMARTSPECTRA_CAMERA_FPS ?? 30),
  });
  sdk.start();
  await sleep(Number.isFinite(durationMs) && durationMs > 0 ? durationMs : 60000);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  stopping = true;
  try {
    await sdk.stopAsync();
  } catch {
    sdk.stop();
  }
  await sdk.destroy();
}

if (process.exitCode) process.exit(process.exitCode);

if (!sawPulse || !sawBreathing) {
  console.error(
    `FAIL: missing live readings. status=${statusText} packets=${metricPackets} pulse=${sawPulse} breathing=${sawBreathing}`,
  );
  process.exit(1);
}

console.log(
  [
    "OK: live camera readings appeared.",
    `packets=${metricPackets}`,
    `pulse=${lastPulse?.toFixed?.(0) ?? "seen"}`,
    `breathing=${lastBreathing?.toFixed?.(0) ?? "seen"}`,
    `pressureSamples=${pressureSamples}`,
    `hrvSamples=${hrvSamples}`,
    `faceSamples=${faceSamples}`,
  ].join(" "),
);
