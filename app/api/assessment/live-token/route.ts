import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";
import { z } from "zod";

import {
  GEMINI_LIVE_MODELS,
  liveConnectConfig,
  liveModelName,
} from "@/lib/gemini/live-config";
import type { AssessmentIncident, AssessmentState } from "@/lib/assessment/types";

export const runtime = "nodejs";

const requestSchema = z.object({
  incident: z
    .object({
      id: z.string(),
      roomId: z.string(),
      resident: z.object({ name: z.string() }).passthrough(),
      responder: z.object({ name: z.string() }).passthrough(),
    })
    .passthrough(),
  state: z.record(z.string(), z.unknown()).default({}),
});

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY is not set." },
      { status: 503 },
    );
  }

  let body: z.infer<typeof requestSchema>;
  try {
    body = requestSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const incident = body.incident as AssessmentIncident;
  const state = body.state as AssessmentState;
  const preferred = liveModelName();
  const models = [preferred, ...GEMINI_LIVE_MODELS.filter((model) => model !== preferred)];

  const ai = new GoogleGenAI({ apiKey });
  const errors: string[] = [];

  for (const model of models) {
    try {
      const token = await ai.authTokens.create({
        config: {
          uses: 1,
          expireTime: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
          newSessionExpireTime: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
          liveConnectConstraints: {
            model,
            config: liveConnectConfig(incident, state),
          },
          httpOptions: { apiVersion: "v1alpha" },
        },
      });

      if (!token.name) throw new Error("Token response was empty.");

      return NextResponse.json({
        token: token.name,
        model,
        apiVersion: "v1alpha",
      });
    } catch (error) {
      errors.push(
        `${model}: ${error instanceof Error ? error.message : "unknown error"}`,
      );
    }
  }

  return NextResponse.json(
    { error: `Unable to start Gemini Live. ${errors.join(" | ")}` },
    { status: 502 },
  );
}
