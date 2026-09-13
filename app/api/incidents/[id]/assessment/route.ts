import { NextResponse } from "next/server";

import { getIncident } from "@/lib/incidents/service";
import type { AssessmentResult } from "@/lib/assessment/types";

export const dynamic = "force-dynamic";

const globalStore = globalThis as unknown as {
  careFallAssessments?: Map<string, AssessmentResult>;
};

const assessmentsByIncident =
  globalStore.careFallAssessments ?? new Map<string, AssessmentResult>();

if (process.env.NODE_ENV !== "production") {
  globalStore.careFallAssessments = assessmentsByIncident;
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const incident = getIncident(id);

  if (!incident && id !== "incident-demo-001") {
    return NextResponse.json({ error: "Incident not found." }, { status: 404 });
  }

  const body = (await request.json().catch(() => null)) as AssessmentResult | null;
  if (!body || body.incidentId !== id) {
    return NextResponse.json({ error: "Invalid assessment result." }, { status: 400 });
  }

  assessmentsByIncident.set(id, body);
  return NextResponse.json({ delivered: true, result: body });
}
