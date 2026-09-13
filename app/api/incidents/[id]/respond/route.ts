import { NextResponse } from "next/server";
import { respondSchema } from "@/lib/validation";
import { respondToIncident, IncidentServiceError } from "@/lib/incidents/service";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = respondSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const incident = respondToIncident(id, parsed.data.responderId);
    return NextResponse.json({ incident });
  } catch (err) {
    if (err instanceof IncidentServiceError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
