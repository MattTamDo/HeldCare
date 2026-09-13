import { NextResponse } from "next/server";

import { getIncident } from "@/lib/incidents/service";
import { RESIDENT_BY_ROOM, RESPONDERS } from "@/lib/mock/data";
import type { AssessmentIncident } from "@/lib/assessment/types";
import type { Incident } from "@/lib/types/incident";

export const dynamic = "force-dynamic";

function toAssessmentIncident(incident: Incident): AssessmentIncident {
  const resident =
    Object.values(RESIDENT_BY_ROOM).find((entry) => entry.id === incident.residentId) ??
    RESIDENT_BY_ROOM[incident.roomId] ?? {
      id: incident.residentId,
      name: incident.residentId,
    };

  const responder =
    RESPONDERS.find((entry) => entry.id === incident.responderId) ??
    (incident.responderName
      ? {
          id: incident.responderId ?? "unknown",
          name: incident.responderName,
          role: "CNA",
        }
      : { id: "sarah", name: "Sarah Miller", role: "CNA" });

  return {
    id: incident.id,
    roomId: incident.roomId,
    resident,
    responder,
    status: incident.status === "responding" ? "arrived" : "detected",
    detectedAt: incident.detectedAt,
    arrivedAt: incident.status === "responding" ? Date.now() : undefined,
  };
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const incident = getIncident(id);

  if (!incident) {
    return NextResponse.json({ error: "Incident not found." }, { status: 404 });
  }

  return NextResponse.json(toAssessmentIncident(incident), {
    headers: { "Cache-Control": "no-store" },
  });
}
