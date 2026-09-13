import { NextResponse } from "next/server";

import type { MobileHealthPacket, MobileHealthSession } from "@/lib/mobile-health/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const sessions = new Map<string, MobileHealthSession>();

function readSession(sessionId: string): MobileHealthSession {
  return sessions.get(sessionId) ?? { packets: 0 };
}

function isVitalsPayload(value: unknown): value is Partial<MobileHealthPacket> {
  return Boolean(value && typeof value === "object" && "vitals" in value);
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await params;
  return NextResponse.json(readSession(sessionId), {
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await params;
  const body: unknown = await request.json().catch(() => undefined);

  if (!isVitalsPayload(body)) {
    return NextResponse.json({ error: "Missing vitals payload." }, { status: 400 });
  }

  const previous = readSession(sessionId);
  const packet: MobileHealthPacket = {
    sessionId,
    vitals: body.vitals ?? {},
    source: body.source ?? "expo-mock",
    cameraFacing: body.cameraFacing,
    processingStatus: body.processingStatus,
    validation: body.validation,
    capturedAt: typeof body.capturedAt === "number" ? body.capturedAt : Date.now(),
  };

  const next: MobileHealthSession = {
    latest: packet,
    packets: previous.packets + 1,
    updatedAt: Date.now(),
  };
  sessions.set(sessionId, next);

  return NextResponse.json(next, {
    headers: { "Cache-Control": "no-store" },
  });
}
