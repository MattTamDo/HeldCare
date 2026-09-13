import { NextRequest, NextResponse } from "next/server";
import { fallEventSchema } from "@/lib/validation";
import { reportFall, IncidentServiceError } from "@/lib/incidents/service";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = fallEventSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const { incident, created } = reportFall(parsed.data);
    return NextResponse.json({ incident, created }, { status: created ? 201 : 200 });
  } catch (err) {
    if (err instanceof IncidentServiceError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
