import type { Vitals } from "@/lib/assessment/types";
import type {
  VitalsMode,
  VitalsProvider,
  VitalsSnapshot,
  VitalsStage,
} from "./types";

/** Stage timings, in ms, for the simulated measurement run. */
const TIMELINE: Array<{ stage: VitalsStage; after: number }> = [
  { stage: "initializing", after: 0 },
  { stage: "searching", after: 900 },
  { stage: "acquired", after: 2100 },
  { stage: "measuring", after: 2900 },
  { stage: "available", after: 5200 },
];

function jitter(center: number, spread: number): number {
  return Math.round(center + (Math.random() * 2 - 1) * spread);
}

/**
 * Simulates a contactless measurement run. This is the default provider and the
 * one used for the demo — it produces plausible estimates without any camera.
 */
export class MockVitalsProvider implements VitalsProvider {
  readonly mode: VitalsMode = "mock";

  private listeners = new Set<(snapshot: VitalsSnapshot) => void>();
  private timers: ReturnType<typeof setTimeout>[] = [];
  private snapshot: VitalsSnapshot = { stage: "idle", vitals: {} };

  subscribe(listener: (snapshot: VitalsSnapshot) => void): () => void {
    this.listeners.add(listener);
    listener(this.snapshot);
    return () => this.listeners.delete(listener);
  }

  private emit(next: VitalsSnapshot) {
    this.snapshot = next;
    this.listeners.forEach((listener) => listener(next));
  }

  async start(): Promise<void> {
    this.clearTimers();
    this.emit({ stage: "idle", vitals: {} });

    for (const { stage, after } of TIMELINE) {
      this.timers.push(
        setTimeout(() => {
          const vitals: Vitals =
            stage === "available"
              ? {
                  pulse: jitter(78, 4),
                  respiration: jitter(16, 2),
                  signalQuality: "GOOD",
                }
              : this.snapshot.vitals;
          this.emit({ stage, vitals });
        }, after),
      );
    }
  }

  async stop(): Promise<void> {
    this.clearTimers();
    // Keep a completed measurement visible; only clear a run still in flight.
    if (this.snapshot.stage !== "available") {
      this.emit({ stage: "idle", vitals: {} });
    }
  }

  async getLatest(): Promise<Vitals> {
    return this.snapshot.vitals;
  }

  private clearTimers() {
    this.timers.forEach(clearTimeout);
    this.timers = [];
  }
}
