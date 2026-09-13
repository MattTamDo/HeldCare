import type { Vitals } from "@/lib/assessment/types";
import type { VitalsMode, VitalsProvider, VitalsSnapshot } from "./types";

/**
 * Live Presage is not enabled in this build. The assessment uses
 * `MockVitalsProvider` so the demo never depends on Electron or SmartSpectra.
 */
export class PresageVitalsProvider implements VitalsProvider {
  readonly mode: VitalsMode = "live";

  async start(): Promise<void> {
    throw new Error(
      "Live Presage is not enabled in this build. Use the simulated measurement.",
    );
  }

  async stop(): Promise<void> {}

  async getLatest(): Promise<Vitals> {
    return {};
  }

  subscribe(listener: (snapshot: VitalsSnapshot) => void): () => void {
    listener({
      stage: "error",
      vitals: {},
      error: "Live Presage is not enabled in this build.",
      retryable: false,
    });
    return () => {};
  }
}
