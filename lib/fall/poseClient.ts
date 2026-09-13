import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";

import { FALL_CONFIG } from "./config";
import type {
  PoseLandmark,
  PoseLandmarkerSettings,
  PoseRuntimeMode,
  PoseWorkerRequest,
  PoseWorkerResponse,
} from "./types";

export type PoseSample = {
  t: number;
  landmarks: PoseLandmark[] | null;
};

/**
 * Pose inference for one or more camera windows. Each window is a `sourceId`
 * with its own MediaPipe landmarker; the runtime itself is shared.
 */
export interface PoseRuntime {
  readonly mode: PoseRuntimeMode;
  readonly delegate: "GPU" | "CPU";
  openSource(sourceId: string): Promise<void>;
  closeSource(sourceId: string): void;
  detect(
    sourceId: string,
    source: HTMLVideoElement,
    t: number,
  ): Promise<PoseSample>;
  close(): void;
}

function settings(): PoseLandmarkerSettings {
  const mp = FALL_CONFIG.mediapipe;
  return {
    wasmBasePath: mp.wasmBasePath,
    modelAssetPath: mp.modelAssetPath,
    delegate: mp.delegate,
    numPoses: mp.numPoses,
    minPoseDetectionConfidence: mp.minPoseDetectionConfidence,
    minPosePresenceConfidence: mp.minPosePresenceConfidence,
    minTrackingConfidence: mp.minTrackingConfidence,
  };
}

// ---------------------------------------------------------------------------
// Web Worker inference (preferred)
// ---------------------------------------------------------------------------

class WorkerPoseRuntime implements PoseRuntime {
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

  static async create(firstSourceId: string): Promise<WorkerPoseRuntime> {
    const worker = new Worker(new URL("./pose.worker.ts", import.meta.url), {
      type: "module",
    });

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

      const request: PoseWorkerRequest = {
        type: "init",
        sourceId: firstSourceId,
        ...settings(),
      };
      worker.postMessage(request);
    }).catch((error: unknown) => {
      worker.terminate();
      throw error;
    });

    return new WorkerPoseRuntime(worker, delegate);
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

  openSource(sourceId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        cleanup();
        reject(new Error(`opening ${sourceId} timed out`));
      }, FALL_CONFIG.runtime.workerInitTimeoutMs);

      const onMessage = (event: MessageEvent<PoseWorkerResponse>) => {
        const message = event.data;
        if (message.type === "opened" && message.sourceId === sourceId) {
          cleanup();
          resolve();
        } else if (message.type === "error" && message.sourceId === sourceId) {
          cleanup();
          reject(new Error(message.message));
        }
      };
      const cleanup = () => {
        window.clearTimeout(timeout);
        this.worker.removeEventListener("message", onMessage);
      };

      this.worker.addEventListener("message", onMessage);
      const request: PoseWorkerRequest = { type: "open", sourceId };
      this.worker.postMessage(request);
    });
  }

  closeSource(sourceId: string): void {
    const request: PoseWorkerRequest = { type: "closeSource", sourceId };
    this.worker.postMessage(request);
  }

  async detect(
    sourceId: string,
    source: HTMLVideoElement,
    t: number,
  ): Promise<PoseSample> {
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

      const request: PoseWorkerRequest = {
        type: "detect",
        id,
        sourceId,
        bitmap,
        t,
      };
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

class MainThreadPoseRuntime implements PoseRuntime {
  readonly mode: PoseRuntimeMode = "main";

  private landmarkers = new Map<string, PoseLandmarker>();

  private constructor(
    readonly delegate: "GPU" | "CPU",
    firstSourceId: string,
    firstLandmarker: PoseLandmarker,
  ) {
    this.landmarkers.set(firstSourceId, firstLandmarker);
  }

  private static async build(
    delegate: "GPU" | "CPU",
  ): Promise<PoseLandmarker> {
    const config = settings();
    const fileset = await FilesetResolver.forVisionTasks(config.wasmBasePath);
    return PoseLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: config.modelAssetPath, delegate },
      runningMode: "VIDEO",
      numPoses: config.numPoses,
      minPoseDetectionConfidence: config.minPoseDetectionConfidence,
      minPosePresenceConfidence: config.minPosePresenceConfidence,
      minTrackingConfidence: config.minTrackingConfidence,
    });
  }

  static async create(firstSourceId: string): Promise<MainThreadPoseRuntime> {
    const preferred = FALL_CONFIG.mediapipe.delegate;
    try {
      const landmarker = await MainThreadPoseRuntime.build(preferred);
      return new MainThreadPoseRuntime(preferred, firstSourceId, landmarker);
    } catch (error) {
      if (preferred === "CPU") throw error;
      console.warn("[CareFall] GPU delegate failed, retrying on CPU", error);
    }

    const landmarker = await MainThreadPoseRuntime.build("CPU");
    return new MainThreadPoseRuntime("CPU", firstSourceId, landmarker);
  }

  async openSource(sourceId: string): Promise<void> {
    if (this.landmarkers.has(sourceId)) return;
    this.landmarkers.set(
      sourceId,
      await MainThreadPoseRuntime.build(this.delegate),
    );
  }

  closeSource(sourceId: string): void {
    this.landmarkers.get(sourceId)?.close();
    this.landmarkers.delete(sourceId);
  }

  async detect(
    sourceId: string,
    source: HTMLVideoElement,
    t: number,
  ): Promise<PoseSample> {
    const landmarker = this.landmarkers.get(sourceId);
    if (!landmarker) throw new Error(`no landmarker for source ${sourceId}`);
    const result = landmarker.detectForVideo(source, t);
    const landmarks = result.landmarks[0];
    return { t, landmarks: landmarks ? (landmarks as PoseLandmark[]) : null };
  }

  close(): void {
    for (const landmarker of this.landmarkers.values()) landmarker.close();
    this.landmarkers.clear();
  }
}

// ---------------------------------------------------------------------------
// Shared runtime, reference counted across camera windows
// ---------------------------------------------------------------------------

let runtimePromise: Promise<PoseRuntime> | null = null;
const openSources = new Set<string>();

async function createRuntime(firstSourceId: string): Promise<PoseRuntime> {
  const workerSupported =
    typeof Worker !== "undefined" && typeof createImageBitmap === "function";

  if (FALL_CONFIG.runtime.preferWorker && workerSupported) {
    try {
      return await WorkerPoseRuntime.create(firstSourceId);
    } catch (error) {
      console.warn(
        "[CareFall] pose worker unavailable, falling back to main thread",
        error,
      );
    }
  }

  return MainThreadPoseRuntime.create(firstSourceId);
}

/**
 * Returns the shared runtime with `sourceId` ready for inference. Every call
 * must be paired with `releasePoseRuntime(sourceId)`.
 */
export async function acquirePoseRuntime(
  sourceId: string,
): Promise<PoseRuntime> {
  if (!runtimePromise) {
    runtimePromise = createRuntime(sourceId).catch((error: unknown) => {
      runtimePromise = null;
      throw error;
    });
    const runtime = await runtimePromise;
    openSources.add(sourceId);
    return runtime;
  }

  const runtime = await runtimePromise;
  if (!openSources.has(sourceId)) {
    await runtime.openSource(sourceId);
    openSources.add(sourceId);
  }
  return runtime;
}

export function releasePoseRuntime(sourceId: string): void {
  if (!runtimePromise) return;
  const pending = runtimePromise;
  openSources.delete(sourceId);

  void pending.then((runtime) => {
    if (openSources.size === 0) {
      runtime.close();
      if (runtimePromise === pending) runtimePromise = null;
    } else {
      runtime.closeSource(sourceId);
    }
  });
}
