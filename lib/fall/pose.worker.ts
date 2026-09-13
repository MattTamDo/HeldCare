/// <reference lib="webworker" />

import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";
import type {
  PoseLandmark,
  PoseWorkerRequest,
  PoseWorkerResponse,
} from "./types";

/**
 * Runs MediaPipe Pose Landmarker off the main thread so camera rendering stays
 * smooth. Frames arrive as transferred `ImageBitmap`s.
 *
 * `poseClient.ts` falls back to main-thread inference if this worker cannot
 * initialize, so nothing here is load-bearing for the demo.
 */

let landmarker: PoseLandmarker | null = null;

function post(message: PoseWorkerResponse, transfer?: Transferable[]): void {
  if (transfer) {
    self.postMessage(message, transfer);
  } else {
    self.postMessage(message);
  }
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
  request: Extract<PoseWorkerRequest, { type: "init" }>,
  delegate: "GPU" | "CPU",
  useModule: boolean,
): Promise<PoseLandmarker> {
  const fileset = await FilesetResolver.forVisionTasks(
    request.wasmBasePath,
    useModule,
  );
  return PoseLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: request.modelAssetPath, delegate },
    runningMode: "VIDEO",
    numPoses: request.numPoses,
    minPoseDetectionConfidence: request.minPoseDetectionConfidence,
    minPosePresenceConfidence: request.minPosePresenceConfidence,
    minTrackingConfidence: request.minTrackingConfidence,
  });
}

async function init(
  request: Extract<PoseWorkerRequest, { type: "init" }>,
): Promise<void> {
  const loaderOrder = isClassicWorkerScope() ? [false, true] : [true, false];
  const delegates: ("GPU" | "CPU")[] =
    request.delegate === "CPU" ? ["CPU"] : ["GPU", "CPU"];

  let lastError: unknown;
  for (const useModule of loaderOrder) {
    for (const delegate of delegates) {
      try {
        landmarker = await createLandmarker(request, delegate, useModule);
        post({ type: "ready", delegate });
        return;
      } catch (error) {
        lastError = error;
      }
    }
  }

  throw lastError ?? new Error("pose landmarker could not be created");
}

self.onmessage = async (event: MessageEvent<PoseWorkerRequest>) => {
  const request = event.data;

  try {
    switch (request.type) {
      case "init": {
        await init(request);
        break;
      }

      case "detect": {
        if (!landmarker) {
          request.bitmap.close();
          post({
            type: "error",
            id: request.id,
            message: "pose landmarker not initialized",
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

      case "close": {
        landmarker?.close();
        landmarker = null;
        self.close();
        break;
      }
    }
  } catch (error) {
    if (request.type === "detect") request.bitmap.close();
    post({
      type: "error",
      id: request.type === "detect" ? request.id : undefined,
      message: error instanceof Error ? error.message : String(error),
    });
  }
};
