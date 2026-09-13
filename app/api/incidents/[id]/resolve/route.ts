import { NextResponse } from "next/server";
import { resolveIncident, IncidentServiceError } from "@/lib/incidents/service";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const incident = resolveIncident(id);
    return NextResponse.json({ incident });
  } catch (err) {
    if (err instanceof IncidentServiceError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
