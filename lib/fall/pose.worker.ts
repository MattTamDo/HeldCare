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

async function createLandmarker(
  request: Extract<PoseWorkerRequest, { type: "init" }>,
  delegate: "GPU" | "CPU",
): Promise<PoseLandmarker> {
  // `useModule: true` loads the ES-module WASM loader, which is the only
  // variant importable from inside a module worker.
  const fileset = await FilesetResolver.forVisionTasks(
    request.wasmBasePath,
    true,
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
  try {
    landmarker = await createLandmarker(request, request.delegate);
    post({ type: "ready", delegate: request.delegate });
    return;
  } catch (error) {
    if (request.delegate === "CPU") throw error;
    console.warn("[CareFall] worker GPU delegate failed, retrying on CPU", error);
  }

  landmarker = await createLandmarker(request, "CPU");
  post({ type: "ready", delegate: "CPU" });
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
