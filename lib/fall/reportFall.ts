import { FALL_CONFIG } from "./config";
import { round } from "./geometry";
import type { FallEvent, FallEvidence, FallTrigger } from "./types";

export type FallReportOutcome =
  | { delivered: true; transport: "http"; event: FallEvent }
  | {
      delivered: false;
      transport: "log" | "none";
      reason: string;
      event: FallEvent;
    };

export type ReportedFall = {
  event: FallEvent;
  trigger: FallTrigger;
  outcome: FallReportOutcome;
};

type FallListener = (report: ReportedFall) => void;

const listeners = new Set<FallListener>();
const reported: ReportedFall[] = [];
let lastReportedAt = 0;

/**
 * The single place a confirmed fall leaves this module — both the detector and
 * the manual `F` fallback call it.
 *
 * Today it logs and (optionally) POSTs. Person 2 only needs to point
 * `NEXT_PUBLIC_FALL_ENDPOINT` at `/api/incidents/fall`; the payload is already
 * the agreed `FallEvent` shape.
 */
export async function reportFall(
  event: FallEvent,
  trigger: FallTrigger = "detector",
): Promise<FallReportOutcome> {
  const now = Date.now();
  const sinceLast = now - lastReportedAt;

  if (lastReportedAt !== 0 && sinceLast < FALL_CONFIG.reporting.dedupeWindowMs) {
    const outcome: FallReportOutcome = {
      delivered: false,
      transport: "none",
      reason: `duplicate suppressed (${sinceLast}ms since last report)`,
      event,
    };
    console.warn("[CareFall] fall report suppressed as duplicate", event);
    return outcome;
  }

  lastReportedAt = now;
  console.info(`[CareFall] FALL_DETECTED (${trigger})`, event);

  const outcome = await deliver(event);
  const report: ReportedFall = { event, trigger, outcome };
  reported.push(report);
  for (const listener of listeners) listener(report);
  return outcome;
}

async function deliver(event: FallEvent): Promise<FallReportOutcome> {
  const endpoint = FALL_CONFIG.reporting.endpoint;
  if (!endpoint) {
    return {
      delivered: false,
      transport: "log",
      reason: "no endpoint configured (set NEXT_PUBLIC_FALL_ENDPOINT)",
      event,
    };
  }

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(event),
    });
    if (!response.ok) {
      return {
        delivered: false,
        transport: "log",
        reason: `endpoint responded ${response.status}`,
        event,
      };
    }
    return { delivered: true, transport: "http", event };
  } catch (error) {
    return {
      delivered: false,
      transport: "log",
      reason: error instanceof Error ? error.message : "network error",
      event,
    };
  }
}

export function createFallEvent(input: {
  roomId: string;
  residentId: string;
  confidence: number;
  evidence?: FallEvidence | null;
  timestamp?: number;
}): FallEvent {
  const event: FallEvent = {
    type: "FALL_DETECTED",
    roomId: input.roomId,
    residentId: input.residentId,
    timestamp: input.timestamp ?? Date.now(),
    confidence: round(Math.min(1, Math.max(0, input.confidence)), 2),
  };
  if (input.evidence) event.evidence = input.evidence;
  return event;
}

export function onFallReported(listener: FallListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getReportedFalls(): ReportedFall[] {
  return [...reported];
}

/**
 * Re-arms the duplicate guard so a judge can stage another fall immediately
 * after a reset, without clearing the visible event history.
 */
export function resetFallDedupe(): void {
  lastReportedAt = 0;
}

export function clearFallReportHistory(): void {
  reported.length = 0;
  lastReportedAt = 0;
}
