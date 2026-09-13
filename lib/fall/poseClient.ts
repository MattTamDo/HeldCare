import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";

import { FALL_CONFIG } from "./config";
import type {
  PoseLandmark,
  PoseRuntimeMode,
  PoseWorkerRequest,
  PoseWorkerResponse,
} from "./types";

export type PoseSample = {
  t: number;
  landmarks: PoseLandmark[] | null;
};

export interface PoseDetector {
  readonly mode: PoseRuntimeMode;
  readonly delegate: "GPU" | "CPU";
  detect(source: HTMLVideoElement, t: number): Promise<PoseSample>;
  close(): void;
}

function landmarkerOptions(delegate: "GPU" | "CPU") {
  const mp = FALL_CONFIG.mediapipe;
  return {
    baseOptions: { modelAssetPath: mp.modelAssetPath, delegate },
    runningMode: "VIDEO" as const,
    numPoses: mp.numPoses,
    minPoseDetectionConfidence: mp.minPoseDetectionConfidence,
    minPosePresenceConfidence: mp.minPosePresenceConfidence,
    minTrackingConfidence: mp.minTrackingConfidence,
  };
}

// ---------------------------------------------------------------------------
// Web Worker inference (preferred)
// ---------------------------------------------------------------------------

class WorkerPoseDetector implements PoseDetector {
  readonly mode: PoseRuntimeMode = "worker";

  private constructor(
    private readonly worker: Worker,
    readonly delegate: "GPU" | "CPU",
  ) {
    this.worker.addEventListener("message", this.handleMessage);
  }

  private nextId = 1;
  private pending = new Map<
    number,
    { resolve: (sample: PoseSample) => void; reject: (error: Error) => void }
  >();

  static async create(): Promise<WorkerPoseDetector> {
    const worker = new Worker(
      new URL("./pose.worker.ts", import.meta.url),
      { type: "module" },
    );

    const delegate = await new Promise<"GPU" | "CPU">((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        cleanup();
        reject(new Error("pose worker init timed out"));
      }, FALL_CONFIG.runtime.workerInitTimeoutMs);

      const onMessage = (event: MessageEvent<PoseWorkerResponse>) => {
        if (event.data.type === "ready") {
          cleanup();
          resolve(event.data.delegate);
        } else if (event.data.type === "error") {
          cleanup();
          reject(new Error(event.data.message));
        }
      };
      const onError = () => {
        cleanup();
        reject(new Error("pose worker failed to load"));
      };
      const cleanup = () => {
        window.clearTimeout(timeout);
        worker.removeEventListener("message", onMessage);
        worker.removeEventListener("error", onError);
      };

      worker.addEventListener("message", onMessage);
      worker.addEventListener("error", onError);

      const mp = FALL_CONFIG.mediapipe;
      const request: PoseWorkerRequest = {
        type: "init",
        wasmBasePath: mp.wasmBasePath,
        modelAssetPath: mp.modelAssetPath,
        delegate: mp.delegate,
        numPoses: mp.numPoses,
        minPoseDetectionConfidence: mp.minPoseDetectionConfidence,
        minPosePresenceConfidence: mp.minPosePresenceConfidence,
        minTrackingConfidence: mp.minTrackingConfidence,
      };
      worker.postMessage(request);
    }).catch((error: unknown) => {
      worker.terminate();
      throw error;
    });

    return new WorkerPoseDetector(worker, delegate);
  }

  private handleMessage = (event: MessageEvent<PoseWorkerResponse>) => {
    const message = event.data;
    if (message.type === "result") {
      this.pending.get(message.id)?.resolve({
        t: message.t,
        landmarks: message.landmarks,
      });
      this.pending.delete(message.id);
    } else if (message.type === "error" && message.id !== undefined) {
      this.pending.get(message.id)?.reject(new Error(message.message));
      this.pending.delete(message.id);
    }
  };

  async detect(source: HTMLVideoElement, t: number): Promise<PoseSample> {
    const bitmap = await createImageBitmap(source);
    const id = this.nextId++;

    return new Promise<PoseSample>((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        this.pending.delete(id);
        reject(new Error("pose inference timed out"));
      }, FALL_CONFIG.runtime.inferenceTimeoutMs);

      this.pending.set(id, {
        resolve: (sample) => {
          window.clearTimeout(timeout);
          resolve(sample);
        },
        reject: (error) => {
          window.clearTimeout(timeout);
          reject(error);
        },
      });

      const request: PoseWorkerRequest = { type: "detect", id, bitmap, t };
      this.worker.postMessage(request, [bitmap]);
    });
  }

  close(): void {
    this.pending.clear();
    this.worker.removeEventListener("message", this.handleMessage);
    const request: PoseWorkerRequest = { type: "close" };
    this.worker.postMessage(request);
    this.worker.terminate();
  }
}

// ---------------------------------------------------------------------------
// Main-thread inference (fallback)
// ---------------------------------------------------------------------------

class MainThreadPoseDetector implements PoseDetector {
  readonly mode: PoseRuntimeMode = "main";

  private constructor(
    private readonly landmarker: PoseLandmarker,
    readonly delegate: "GPU" | "CPU",
  ) {}

  static async create(): Promise<MainThreadPoseDetector> {
    const fileset = await FilesetResolver.forVisionTasks(
      FALL_CONFIG.mediapipe.wasmBasePath,
    );

    try {
      const landmarker = await PoseLandmarker.createFromOptions(
        fileset,
        landmarkerOptions(FALL_CONFIG.mediapipe.delegate),
      );
      return new MainThreadPoseDetector(
        landmarker,
        FALL_CONFIG.mediapipe.delegate,
      );
    } catch (error) {
      if (FALL_CONFIG.mediapipe.delegate === "CPU") throw error;
      console.warn("[CareFall] GPU delegate failed, retrying on CPU", error);
    }

    const landmarker = await PoseLandmarker.createFromOptions(
      fileset,
      landmarkerOptions("CPU"),
    );
    return new MainThreadPoseDetector(landmarker, "CPU");
  }

  async detect(source: HTMLVideoElement, t: number): Promise<PoseSample> {
    const result = this.landmarker.detectForVideo(source, t);
    const landmarks = result.landmarks[0];
    return { t, landmarks: landmarks ? (landmarks as PoseLandmark[]) : null };
  }

  close(): void {
    this.landmarker.close();
  }
}

export async function createPoseDetector(options?: {
  preferWorker?: boolean;
}): Promise<PoseDetector> {
  const preferWorker =
    options?.preferWorker ?? FALL_CONFIG.runtime.preferWorker;

  const workerSupported =
    typeof Worker !== "undefined" && typeof createImageBitmap === "function";

  if (preferWorker && workerSupported) {
    try {
      return await WorkerPoseDetector.create();
    } catch (error) {
      console.warn(
        "[CareFall] pose worker unavailable, falling back to main thread",
        error,
      );
    }
  }

  return MainThreadPoseDetector.create();
}
