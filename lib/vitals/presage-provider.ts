import type { Vitals } from "@/lib/assessment/types";
import { vitalsFromSmartSpectraMetrics } from "./smartspectra-metrics";
import type {
  VitalsMode,
  VitalsProvider,
  VitalsSnapshot,
  VitalsStage,
} from "./types";

type ElectronSmartSpectraConfig = {
  isElectron?: boolean;
  smartSpectraApiKey?: string;
  smartSpectraMetrics?: {
    breathing?: number[];
    cardio?: number[];
    face?: number[];
  };
};

declare global {
  interface Window {
    __carefallElectron?: ElectronSmartSpectraConfig;
  }
}

/**
 * Placeholder for the real Presage SmartSpectra integration.
 *
 * This is intentionally NOT implemented against a guessed SDK surface. It holds
 * the shape of the live path — camera acquisition, then readings pushed through
 * the same snapshot stream as the mock — so that wiring the real SDK is a
 * contained change to `beginMeasurement` below.
 *
 * Until that happens `start()` rejects, and `createVitalsProvider()` falls back
 * to `MockVitalsProvider`. The module never blocks on Presage.
 */
export class PresageVitalsProvider implements VitalsProvider {
  readonly mode: VitalsMode = "live";

  private listeners = new Set<(snapshot: VitalsSnapshot) => void>();
  private snapshot: VitalsSnapshot = { stage: "idle", vitals: {} };
  private stream?: MediaStream;
  private sdkOwnsStream = false;
  private startPromise?: Promise<void>;
  private sdk?: {
    start(): Promise<void>;
    stop(): Promise<void>;
    destroy(): void;
    useMediaStream(stream: MediaStream): unknown;
    on(event: "streamAvailable", callback: (stream: MediaStream) => void): unknown;
    on(
      event: "processingStatus",
      callback: (status: number) => void,
    ): unknown;
    on(
      event: "validationStatus",
      callback: (code: number, timestampUs: number, hint?: string) => void,
    ): unknown;
    on(event: "metrics", callback: (buf: Uint8Array) => void): unknown;
    on(
      event: "error",
      callback: (code: number, message: string, retryable: boolean) => void,
    ): unknown;
  };

  subscribe(listener: (snapshot: VitalsSnapshot) => void): () => void {
    this.listeners.add(listener);
    listener(this.snapshot);
    return () => this.listeners.delete(listener);
  }

  private emit(
    stage: VitalsStage,
    vitals: Vitals = this.snapshot.vitals,
    next?: Partial<Omit<VitalsSnapshot, "stage" | "vitals">>,
  ) {
    this.snapshot = { ...this.snapshot, ...next, stage, vitals };
    this.listeners.forEach((listener) => listener(this.snapshot));
  }

  async start(): Promise<void> {
    if (this.startPromise) return this.startPromise;
    if (this.sdk && this.snapshot.stage !== "error") return;
    if (this.sdk) await this.stop();

    this.startPromise = this.startInternal().finally(() => {
      this.startPromise = undefined;
    });
    return this.startPromise;
  }

  private async startInternal(): Promise<void> {
    this.emit("initializing");

    const electron = window.__carefallElectron;
    if (!electron?.isElectron) {
      const message =
        "SmartSpectra live mode requires the Electron shell. Browser TypeScript cannot run @smartspectra/node-sdk directly.";
      this.emit("error", {}, { error: message, retryable: false });
      throw new Error(message);
    }

    if (!this.stream) {
      this.emit("searching", this.snapshot.vitals, {
        validationHint: "Opening the SmartSpectra camera.",
      });
      await this.beginMeasurement();
      return;
    }

    try {
      try {
        this.stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: "user",
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            frameRate: { ideal: 30 },
          },
        });
      } catch {
        this.stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: true,
        });
      }
    } catch {
      const message = "Camera permission denied.";
      this.emit("error", {}, { error: message, retryable: true });
      throw new Error(message);
    }

    this.emit("searching", this.snapshot.vitals, {
      validationHint: "Keep the resident centered, still, and well lit.",
    });
    await this.beginMeasurement();
  }

  private stageFromProcessingStatus(status: number): VitalsStage {
    if (status === 2) return "initializing";
    if (status === 3) return "measuring";
    if (status === 5) return "error";
    return this.snapshot.stage;
  }

  private validationMessage(code: number, hint?: string): string {
    if (hint) return hint;
    if (code === 0) return "Hold still and record.";
    if (code === 1) return "No face found.";
    if (code === 2) return "Only one face is allowed.";
    if (code === 5) return "Increase light on face.";
    if (code === 7) return "Place more of the chest in view.";
    if (code === 17) return "Face the camera.";
    return `Validation ${code}`;
  }

  private async beginMeasurement(): Promise<void> {
    const electron = window.__carefallElectron;
    if (!electron?.isElectron) {
      const message =
        "SmartSpectra live mode requires the Electron shell. Browser TypeScript cannot run @smartspectra/node-sdk directly.";
      this.emit("error", {}, { error: message, retryable: false });
      throw new Error(message);
    }

    const apiKey = electron.smartSpectraApiKey;
    if (!apiKey) {
      await this.stop();
      const message = "SMARTSPECTRA_API_KEY is missing from the Electron environment.";
      this.emit("error", {}, { error: message, retryable: true });
      throw new Error(message);
    }

    const [{ SmartSpectraSDK }, { decodeMetrics }] = await Promise.all([
      import("@smartspectra/node-sdk/renderer"),
      import("@smartspectra/node-sdk/messages"),
    ]);

    const requestedMetrics = [
      ...(electron.smartSpectraMetrics?.breathing ?? []),
      ...(electron.smartSpectraMetrics?.cardio ?? []),
      ...(electron.smartSpectraMetrics?.face ?? []),
    ];

    const sdk = new SmartSpectraSDK({
      apiKey,
      requestedMetrics,
      enableAccumulatedOutput: true,
      enableTelemetry: true,
    });
    this.sdk = sdk;
    this.sdkOwnsStream = !this.stream;

    sdk.on("streamAvailable", (stream) => {
      this.stream = stream;
      this.sdkOwnsStream = true;
      window.dispatchEvent(
        new CustomEvent("carefall:presage-stream", { detail: stream }),
      );
      this.emit("acquired", this.snapshot.vitals, {
        validationHint: "SmartSpectra camera connected.",
      });
    });

    sdk.on("processingStatus", (status) => {
      const stage = this.stageFromProcessingStatus(status);
      this.emit(stage, this.snapshot.vitals, { processingStatus: status });
    });

    sdk.on("validationStatus", (code, _timestampUs, hint) => {
      this.emit(this.snapshot.stage, this.snapshot.vitals, {
        validationCode: code,
        validationHint: this.validationMessage(code, hint),
      });
    });

    sdk.on("metrics", (buf) => {
      const metrics = decodeMetrics(buf) as unknown;
      if (buf instanceof Uint8Array && metrics instanceof Uint8Array) return;

      const vitals = vitalsFromSmartSpectraMetrics(
        metrics as Parameters<typeof vitalsFromSmartSpectraMetrics>[0],
        this.snapshot.vitals,
      );
      this.emit("available", vitals);
    });

    sdk.on("error", (code, message, retryable) => {
      this.emit("error", this.snapshot.vitals, {
        error: message,
        errorCode: code,
        retryable,
      });
    });

    if (this.stream) sdk.useMediaStream(this.stream);
    try {
      await sdk.start();
    } catch (error) {
      await this.stop();
      const message =
        error instanceof Error ? error.message : "SmartSpectra failed to start.";
      this.emit("error", this.snapshot.vitals, {
        error: message,
        retryable: true,
      });
      throw error;
    }
  }

  async stop(): Promise<void> {
    await this.sdk?.stop().catch(() => undefined);
    this.sdk?.destroy();
    this.sdk = undefined;
    window.dispatchEvent(
      new CustomEvent("carefall:presage-stream", { detail: null }),
    );
    if (!this.sdkOwnsStream) {
      this.stream?.getTracks().forEach((track) => track.stop());
    }
    this.stream = undefined;
    this.sdkOwnsStream = false;
  }

  async getLatest(): Promise<Vitals> {
    return this.snapshot.vitals;
  }
}
