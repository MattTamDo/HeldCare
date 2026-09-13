import { EventEmitter } from "events";
import type { RealtimeEvent } from "@/lib/types/incident";

const globalForBus = globalThis as unknown as { incidentBus?: EventEmitter };

export const incidentBus = globalForBus.incidentBus ?? new EventEmitter();
incidentBus.setMaxListeners(0);

if (process.env.NODE_ENV !== "production") {
  globalForBus.incidentBus = incidentBus;
}

export const CHANNEL = "incident-event";

export function publish(event: RealtimeEvent) {
  incidentBus.emit(CHANNEL, event);
}
