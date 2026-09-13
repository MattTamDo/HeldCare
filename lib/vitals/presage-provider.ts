import type { Vitals } from "@/lib/assessment/types";
import type {
  VitalsMode,
  VitalsProvider,
  VitalsSnapshot,
  VitalsStage,
} from "./types";

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

  subscribe(listener: (snapshot: VitalsSnapshot) => void): () => void {
    this.listeners.add(listener);
    listener(this.snapshot);
    return () => this.listeners.delete(listener);
  }

  private emit(stage: VitalsStage, vitals: Vitals = this.snapshot.vitals, error?: string) {
    this.snapshot = { stage, vitals, error };
    this.listeners.forEach((listener) => listener(this.snapshot));
  }

  async start(): Promise<void> {
    this.emit("initializing");

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
      });
    } catch {
      const message = "Camera permission denied.";
      this.emit("error", {}, message);
      throw new Error(message);
    }

    this.emit("searching");
    await this.beginMeasurement();
  }

  /**
   * Hand `this.stream` to the Presage SDK here and emit "acquired" →
   * "measuring" → "available" as readings arrive.
   */
  private async beginMeasurement(): Promise<never> {
    await this.stop();
    const message = "Presage SDK is not wired up in this build.";
    this.emit("error", {}, message);
    throw new Error(message);
  }

  async stop(): Promise<void> {
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = undefined;
  }

  async getLatest(): Promise<Vitals> {
    return this.snapshot.vitals;
  }
}
