import { NextRequest, NextResponse } from "next/server";
import { resetDemo } from "@/lib/incidents/service";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const roomId = typeof body?.roomId === "string" ? body.roomId : "204";

  resetDemo(roomId);

  return NextResponse.json({ ok: true });
}
