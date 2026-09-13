import { randomUUID } from "crypto";
import { publish } from "@/lib/realtime/bus";
import { RESPONDERS, ROOM_IDS } from "@/lib/mock/data";
import { incidentsById, activeIncidentForRoom } from "@/lib/mock/store";
import type { FallEvent, Incident } from "@/lib/types/incident";

export class IncidentServiceError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

/** Consumes a FallEvent. Duplicate-safe: returns the existing alert if the room already has one. */
export function reportFall(event: FallEvent): { incident: Incident; created: boolean } {
  if (!ROOM_IDS.includes(event.roomId)) {
    throw new IncidentServiceError(`Unknown room "${event.roomId}"`, 404);
  }

  const existing = activeIncidentForRoom(event.roomId);
  if (existing) {
    return { incident: existing, created: false };
  }

  const incident: Incident = {
    id: randomUUID(),
    roomId: event.roomId,
    residentId: event.residentId,
    status: "alert",
    fallConfidence: event.confidence,
    detectedAt: event.timestamp,
  };

  incidentsById.set(incident.id, incident);
  publish({ type: "incident_created", incident });

  return { incident, created: true };
}

/** A responder from the mock roster claims the alert. */
export function respondToIncident(incidentId: string, responderId: string): Incident {
  const incident = incidentsById.get(incidentId);
  if (!incident) throw new IncidentServiceError("Incident not found", 404);

  const responder = RESPONDERS.find((r) => r.id === responderId);
  if (!responder) throw new IncidentServiceError(`Unknown responder "${responderId}"`, 404);

  const updated: Incident = { ...incident, status: "responding", responderId, responderName: responder.name };
  incidentsById.set(incidentId, updated);
  publish({ type: "incident_responding", incident: updated });

  return updated;
}

export function getIncident(incidentId: string): Incident | undefined {
  return incidentsById.get(incidentId);
}

export function resolveIncident(incidentId: string): Incident {
  const incident = incidentsById.get(incidentId);
  if (!incident) throw new IncidentServiceError("Incident not found", 404);

  incidentsById.delete(incidentId);
  publish({ type: "incident_resolved", incident });

  return incident;
}

/** Clears any active alert in the given room. Repeatable for judges. */
export function resetDemo(roomId: string): void {
  const incident = activeIncidentForRoom(roomId);
  if (incident) {
    incidentsById.delete(incident.id);
    publish({ type: "incident_resolved", incident });
  }
}
