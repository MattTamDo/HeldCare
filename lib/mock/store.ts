import type { Incident } from "@/lib/types/incident";

// In-memory demo store. No DB — resets whenever the server restarts.
// Kept on globalThis so Next's dev hot-reload doesn't wipe it between edits.
const globalStore = globalThis as unknown as { careFallIncidents?: Map<string, Incident> };

export const incidentsById = globalStore.careFallIncidents ?? new Map<string, Incident>();
if (process.env.NODE_ENV !== "production") {
  globalStore.careFallIncidents = incidentsById;
}

export function activeIncidentForRoom(roomId: string): Incident | undefined {
  for (const incident of incidentsById.values()) {
    if (incident.roomId === roomId) return incident;
  }
  return undefined;
}

export function allActiveIncidents(): Incident[] {
  return Array.from(incidentsById.values());
}
