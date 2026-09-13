import { NextResponse } from "next/server";

import { runtimeConfig } from "@/lib/config/runtime";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET() {
  return NextResponse.json(runtimeConfig(), {
    headers: { "Cache-Control": "no-store" },
  });
}
