import type { Vitals } from "@/lib/assessment/types";

declare global {
  interface Window {
    __carefallElectron?: { isElectron?: boolean };
  }
}

/** Stages surfaced to the responder while a measurement runs. */
export type VitalsStage =
  | "idle"
  | "initializing"
  | "searching"
  | "acquired"
  | "measuring"
  | "available"
  | "error";

export const STAGE_LABELS: Record<VitalsStage, string> = {
  idle: "Not started",
  initializing: "Initializing camera…",
  searching: "Looking for signal…",
  acquired: "Signal acquired",
  measuring: "Measuring…",
  available: "Measurement available",
  error: "Measurement unavailable",
};

export type VitalsSnapshot = {
  stage: VitalsStage;
  vitals: Vitals;
  processingStatus?: number;
  validationCode?: number;
  validationHint?: string;
  retryable?: boolean;
  errorCode?: number;
  /** Present only when `stage === "error"`. */
  error?: string;
};

export type VitalsMode = "mock" | "live";

/**
 * Adapter boundary. The assessment UI only ever talks to this interface, so a
 * missing or broken Presage SDK can never block the module (see module 3 spec).
 *
 * `start` / `stop` / `getLatest` are the agreed contract; `subscribe` is an
 * optional extra so the UI can render stage progress instead of polling.
 */
export interface VitalsProvider {
  readonly mode: VitalsMode;
  start(): Promise<void>;
  stop(): Promise<void>;
  getLatest(): Promise<Vitals>;
  subscribe?(listener: (snapshot: VitalsSnapshot) => void): () => void;
}
