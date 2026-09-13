import { NextResponse } from "next/server";

import { runtimeConfig } from "@/lib/config/runtime";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function baseUrlFrom(request: Request): string {
  const configured =
    process.env.CLOUDFLARE_TUNNEL_URL ?? process.env.NEXT_PUBLIC_PHONE_BASE_URL;
  if (configured) return configured.replace(/\/$/, "");

  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}

export function GET(request: Request) {
  const url = new URL(request.url);
  const sessionId = url.searchParams.get("sessionId");

  if (!sessionId) {
    return NextResponse.json({ error: "Missing sessionId." }, { status: 400 });
  }

  const config = runtimeConfig();
  const transport =
    config.phoneCamera.transport === "livekit"
      ? "livekit"
      : config.phoneCamera.transport === "local"
        ? "local"
        : config.livekit.configured
          ? "livekit"
          : "local";
  const pairUrl = new URL(`/phone-camera/${encodeURIComponent(sessionId)}`, baseUrlFrom(request));
  pairUrl.searchParams.set("transport", transport);

  if (transport === "livekit" && process.env.LIVEKIT_ACCESS_CODE) {
    pairUrl.searchParams.set("code", process.env.LIVEKIT_ACCESS_CODE);
  }

  return NextResponse.json(
    {
      url: pairUrl.toString(),
      transport,
      livekitUrl: config.livekit.url,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
