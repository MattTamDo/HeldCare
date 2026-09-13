import { createHmac } from "node:crypto";

import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";

const requestSchema = z.object({
  room: z.string().min(1).max(128),
  identity: z.string().min(1).max(128),
  name: z.string().max(128).optional(),
  accessCode: z.string().max(128).optional(),
});

function base64Url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function signJwt(payload: Record<string, unknown>, secret: string): string {
  const header = { alg: "HS256", typ: "JWT" };
  const encodedHeader = base64Url(JSON.stringify(header));
  const encodedPayload = base64Url(JSON.stringify(payload));
  const signature = createHmac("sha256", secret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest();

  return `${encodedHeader}.${encodedPayload}.${base64Url(signature)}`;
}

export async function POST(request: Request) {
  const url = process.env.LIVEKIT_URL;
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;

  if (!url || !apiKey || !apiSecret) {
    return NextResponse.json(
      { error: "LiveKit is not configured." },
      { status: 503 },
    );
  }

  let body: z.infer<typeof requestSchema>;
  try {
    body = requestSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (
    process.env.LIVEKIT_ACCESS_CODE &&
    body.accessCode !== process.env.LIVEKIT_ACCESS_CODE
  ) {
    return NextResponse.json({ error: "Invalid access code." }, { status: 401 });
  }

  const now = Math.floor(Date.now() / 1000);
  const token = signJwt(
    {
      iss: apiKey,
      sub: body.identity,
      name: body.name ?? body.identity,
      nbf: now - 10,
      exp: now + 60 * 30,
      video: {
        room: body.room,
        roomJoin: true,
        canPublish: true,
        canSubscribe: true,
      },
    },
    apiSecret,
  );

  return NextResponse.json(
    { token, url },
    { headers: { "Cache-Control": "no-store" } },
  );
}
