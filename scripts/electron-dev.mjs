#!/usr/bin/env node

import { spawn } from "node:child_process";
import { once } from "node:events";
import { existsSync, readFileSync } from "node:fs";

function loadDotEnv(path = ".env") {
  if (!existsSync(path)) return {};
  const env = {};
  const lines = readFileSync(path, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(trimmed);
    if (!match) continue;
    const [, key, rawValue] = match;
    env[key] = rawValue.replace(/^['"]|['"]$/g, "");
  }
  return env;
}

const url =
  process.env.ELECTRON_START_URL ??
  "http://localhost:3000/responder/incident/incident-demo-001/assessment";
const port = Number(new URL(url).port || 3000);
const fileEnv = loadDotEnv();

function spawnChild(command, args, env = {}) {
  return spawn(command, args, {
    env: { ...process.env, ...fileEnv, ...env },
    stdio: "inherit",
  });
}

async function isReady() {
  try {
    const response = await fetch(url, { method: "HEAD" });
    return response.ok || response.status < 500;
  } catch {
    return false;
  }
}

async function waitForNext(timeoutMs = 60_000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await isReady()) return;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Timed out waiting for Next on port ${port}`);
}

let next;
let electron;
let shuttingDown = false;

async function shutdown(signal = "SIGTERM") {
  if (shuttingDown) return;
  shuttingDown = true;
  electron?.kill(signal);
  next?.kill(signal);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

if (await isReady()) {
  console.log(`Next already running at ${url}`);
} else {
  console.log(`Starting Next dev server on port ${port}...`);
  next = spawnChild("npm", ["run", "dev"]);
  await waitForNext();
}

console.log("Starting Electron...");
electron = spawnChild("electron", ["electron/main.cjs"], {
  ELECTRON_START_URL: url,
});

const [code, signal] = await once(electron, "exit");
await shutdown();
process.exit(typeof code === "number" ? code : signal ? 1 : 0);
