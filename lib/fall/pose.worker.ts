/// <reference lib="webworker" />

import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";
import type {
  PoseLandmark,
  PoseLandmarkerSettings,
  PoseWorkerRequest,
  PoseWorkerResponse,
} from "./types";

/**
 * Runs MediaPipe Pose Landmarker off the main thread so camera rendering stays
 * smooth. Frames arrive as transferred `ImageBitmap`s.
 *
 * Every camera window shares this worker but owns a separate landmarker, keyed
 * by `sourceId`, so MediaPipe's video tracking never sees two streams mixed
 * together. `poseClient.ts` falls back to main-thread inference if this worker
 * cannot initialize, so nothing here is load-bearing for the demo.
 */

const landmarkers = new Map<string, PoseLandmarker>();

let settings: PoseLandmarkerSettings | null = null;
/** Loader variant and delegate that actually worked, reused for later windows. */
let resolved: { useModule: boolean; delegate: "GPU" | "CPU" } | null = null;

function post(message: PoseWorkerResponse): void {
  self.postMessage(message);
}

/**
 * MediaPipe ships two WASM loaders: a classic script and an ES module. Which
 * one works depends on the worker type the bundler produced, and bundlers do
 * not agree — Turbopack emits a classic worker even when asked for a module.
 * Module workers expose `importScripts` but throw when it is called, so a
 * zero-argument call is a safe probe.
 */
function isClassicWorkerScope(): boolean {
  if (typeof importScripts !== "function") return false;
  try {
    importScripts();
    return true;
  } catch {
    return false;
  }
}

async function createLandmarker(
  config: PoseLandmarkerSettings,
  delegate: "GPU" | "CPU",
  useModule: boolean,
): Promise<PoseLandmarker> {
  const fileset = await FilesetResolver.forVisionTasks(
    config.wasmBasePath,
    useModule,
  );
  return PoseLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: config.modelAssetPath, delegate },
    runningMode: "VIDEO",
    numPoses: config.numPoses,
    minPoseDetectionConfidence: config.minPoseDetectionConfidence,
    minPosePresenceConfidence: config.minPosePresenceConfidence,
    minTrackingConfidence: config.minTrackingConfidence,
  });
}

/** First window also decides which loader/delegate combination works here. */
async function init(
  request: Extract<PoseWorkerRequest, { type: "init" }>,
): Promise<void> {
  const { type, sourceId, ...config } = request;
  void type;
  settings = config;

  const loaderOrder = isClassicWorkerScope() ? [false, true] : [true, false];
  const delegates: ("GPU" | "CPU")[] =
    config.delegate === "CPU" ? ["CPU"] : ["GPU", "CPU"];

  let lastError: unknown;
  for (const useModule of loaderOrder) {
    for (const delegate of delegates) {
      try {
        const landmarker = await createLandmarker(config, delegate, useModule);
        landmarkers.set(sourceId, landmarker);
        resolved = { useModule, delegate };
        post({ type: "ready", delegate });
        return;
      } catch (error) {
        lastError = error;
      }
    }
  }

  throw lastError ?? new Error("pose landmarker could not be created");
}

async function openSource(sourceId: string): Promise<void> {
  if (landmarkers.has(sourceId)) {
    post({ type: "opened", sourceId });
    return;
  }
  if (!settings || !resolved) {
    throw new Error("pose worker is not initialized");
  }

  const landmarker = await createLandmarker(
    settings,
    resolved.delegate,
    resolved.useModule,
  );
  landmarkers.set(sourceId, landmarker);
  post({ type: "opened", sourceId });
}

self.onmessage = async (event: MessageEvent<PoseWorkerRequest>) => {
  const request = event.data;

  try {
    switch (request.type) {
      case "init": {
        await init(request);
        break;
      }

      case "open": {
        await openSource(request.sourceId);
        break;
      }

      case "detect": {
        const landmarker = landmarkers.get(request.sourceId);
        if (!landmarker) {
          request.bitmap.close();
          post({
            type: "error",
            id: request.id,
            sourceId: request.sourceId,
            message: `no landmarker for source ${request.sourceId}`,
          });
          return;
        }

        const result = landmarker.detectForVideo(request.bitmap, request.t);
        request.bitmap.close();

        const landmarks = result.landmarks[0];
        post({
          type: "result",
          id: request.id,
          t: request.t,
          landmarks: landmarks ? (landmarks as PoseLandmark[]) : null,
        });
        break;
      }

      case "closeSource": {
        landmarkers.get(request.sourceId)?.close();
        landmarkers.delete(request.sourceId);
        break;
      }

      case "close": {
        for (const landmarker of landmarkers.values()) landmarker.close();
        landmarkers.clear();
        self.close();
        break;
      }
    }
  } catch (error) {
    if (request.type === "detect") request.bitmap.close();
    post({
      type: "error",
      id: request.type === "detect" ? request.id : undefined,
      sourceId: "sourceId" in request ? request.sourceId : undefined,
      message: error instanceof Error ? error.message : String(error),
    });
  }
};
