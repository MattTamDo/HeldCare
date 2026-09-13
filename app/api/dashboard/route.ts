import { NextResponse } from "next/server";
import { buildIncidentBoard } from "@/lib/incidents/board";

export async function GET() {
  return NextResponse.json(buildIncidentBoard());
}
