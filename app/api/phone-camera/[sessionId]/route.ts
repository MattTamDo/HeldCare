import { NextResponse } from "next/server";

import type {
  PhoneCameraSignalRequest,
  PhoneCameraSessionState,
} from "@/lib/phone-camera/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TTL_MS = 15 * 60 * 1000;

type Store = Map<string, PhoneCameraSessionState>;

const globalStore = globalThis as typeof globalThis & {
  __carefallPhoneCameraSessions?: Store;
};

function sessions(): Store {
  globalStore.__carefallPhoneCameraSessions ??= new Map();
  return globalStore.__carefallPhoneCameraSessions;
}

function emptySession(sessionId: string): PhoneCameraSessionState {
  return {
    sessionId,
    hostCandidates: [],
    phoneCandidates: [],
    updatedAt: Date.now(),
  };
}

function prune(now = Date.now()) {
  for (const [id, session] of sessions()) {
    if (now - session.updatedAt > TTL_MS) sessions().delete(id);
  }
}

function readSession(sessionId: string): PhoneCameraSessionState {
  prune();
  const existing = sessions().get(sessionId);
  if (existing) return existing;

  const created = emptySession(sessionId);
  sessions().set(sessionId, created);
  return created;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await context.params;
  return NextResponse.json(readSession(sessionId), {
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await context.params;
  const body = (await request.json()) as PhoneCameraSignalRequest;

  if (!body || !body.role || !body.kind) {
    return NextResponse.json({ error: "Invalid signal payload." }, { status: 400 });
  }

  if (body.kind === "reset") {
    const reset = emptySession(sessionId);
    sessions().set(sessionId, reset);
    return NextResponse.json(reset, {
      headers: { "Cache-Control": "no-store" },
    });
  }

  const session = readSession(sessionId);
  session.updatedAt = Date.now();

  if (body.kind === "offer") {
    session.offer = body.description;
    session.answer = undefined;
    session.hostCandidates = [];
    session.phoneCandidates = [];
  } else if (body.kind === "answer") {
    session.answer = body.description;
  } else if (body.kind === "candidate") {
    const target =
      body.role === "host" ? session.hostCandidates : session.phoneCandidates;
    target.push(body.candidate);
  }

  sessions().set(sessionId, session);

  return NextResponse.json(session, {
    headers: { "Cache-Control": "no-store" },
  });
}
