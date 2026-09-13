import { getMonitoredRoom } from "@/lib/fall/config";
import type { IncidentBoardData } from "@/lib/incidents/board";
import { RESPONDERS } from "@/lib/mock/data";
import type { RoomState } from "@/lib/types/incident";

import type { AssessmentIncident } from "./types";

export const DEMO_INCIDENT_ID = "incident-demo-001";

const DEFAULT_RESPONDER = RESPONDERS[0] ?? {
  id: "sarah",
  name: "Sarah Miller",
  role: "CNA",
};

export function incidentFromRoom(
  id: string,
  roomId: string,
  extras: Partial<AssessmentIncident> = {},
): AssessmentIncident {
  const room = getMonitoredRoom(roomId);
  return {
    id,
    roomId,
    resident: { id: room.residentId, name: room.residentName },
    responder: extras.responder ?? DEFAULT_RESPONDER,
    status: extras.status ?? "arrived",
    detectedAt: extras.detectedAt ?? Date.now() - 25_000,
    arrivedAt: extras.arrivedAt ?? Date.now(),
  };
}

/** Demo seed only. Real falls use the incident API / dashboard room. */
export const mockIncident: AssessmentIncident = incidentFromRoom(
  DEMO_INCIDENT_ID,
  "204",
);

export function responderPath(
  incidentId: string,
  view: "assessment" | "copilot",
  roomId?: string,
): string {
  const path = `/responder/incident/${incidentId}/${view}`;
  return roomId ? `${path}?room=${encodeURIComponent(roomId)}` : path;
}

function fromBoardRoom(room: RoomState): AssessmentIncident | undefined {
  const incident = room.incident;
  if (!incident) return undefined;
  return incidentFromRoom(incident.id, room.id, {
    responder: incident.responderName
      ? {
          id: incident.responderId ?? "unknown",
          name: incident.responderName,
          role: "CNA",
        }
      : undefined,
    status: incident.status === "responding" ? "arrived" : "detected",
    detectedAt: incident.detectedAt,
    arrivedAt: incident.status === "responding" ? Date.now() : undefined,
  });
}

/**
 * Load the fall that matches this incident id. Never rewrite an unknown
 * incident onto room 204 — that hid falls from 201–203.
 */
export async function loadIncident(
  id: string,
  roomHint?: string,
): Promise<{
  incident: AssessmentIncident;
  source: "api" | "mock";
}> {
  try {
    const response = await fetch(`/api/incidents/${encodeURIComponent(id)}`, {
      cache: "no-store",
    });
    if (response.ok) {
      const data = (await response.json()) as Partial<AssessmentIncident>;
      const roomId = data.roomId ?? roomHint;
      if (roomId) {
        return {
          incident: {
            ...incidentFromRoom(id, roomId),
            ...data,
            id,
            roomId,
            resident: data.resident ?? incidentFromRoom(id, roomId).resident,
          },
          source: "api",
        };
      }
    }
  } catch {
    // Try the live board next.
  }

  try {
    const boardResponse = await fetch("/api/dashboard", { cache: "no-store" });
    if (boardResponse.ok) {
      const board = (await boardResponse.json()) as IncidentBoardData;
      const match =
        board.rooms.find((room) => room.incident?.id === id) ??
        (roomHint
          ? board.rooms.find((room) => room.id === roomHint && room.incident)
          : undefined) ??
        board.rooms.find((room) => room.incident);
      const fromBoard = match ? fromBoardRoom(match) : undefined;
      if (fromBoard) return { incident: fromBoard, source: "api" };
    }
  } catch {
    // Last resort below.
  }

  if (roomHint) {
    return { incident: incidentFromRoom(id, roomHint), source: "mock" };
  }
  if (id === DEMO_INCIDENT_ID) {
    return { incident: mockIncident, source: "mock" };
  }
  return { incident: incidentFromRoom(id, "unknown"), source: "mock" };
}
