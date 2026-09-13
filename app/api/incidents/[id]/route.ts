import { NextResponse } from "next/server";

import { mockIncident } from "@/lib/assessment/incident";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  return NextResponse.json(
    {
      ...mockIncident,
      id,
      detectedAt: Date.now() - 25_000,
      arrivedAt: Date.now(),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
