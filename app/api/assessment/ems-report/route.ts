import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";
import { z } from "zod";

import { buildEmsReport } from "@/lib/assessment/ems-report";
import type { AssessmentIncident, AssessmentState } from "@/lib/assessment/types";

export const runtime = "nodejs";

const requestSchema = z.object({
  incident: z
    .object({
      id: z.string(),
      roomId: z.string(),
      resident: z.object({ name: z.string() }).passthrough(),
      responder: z.object({ name: z.string() }).passthrough(),
      detectedAt: z.number().optional(),
    })
    .passthrough(),
  state: z.record(z.string(), z.unknown()).default({}),
  transcript: z
    .object({
      responder: z.string().optional(),
      copilot: z.string().optional(),
    })
    .optional(),
});

export async function POST(request: Request) {
  let body: z.infer<typeof requestSchema>;
  try {
    body = requestSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const incident = {
    detectedAt: Date.now() - 25_000,
    ...body.incident,
  } as AssessmentIncident;
  const state = body.state as AssessmentState;
  const draft = buildEmsReport(incident, state, body.transcript);
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return NextResponse.json({ report: draft, source: "template" });
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const model = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
    const response = await ai.models.generateContent({
      model,
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `Rewrite this EMS handoff as a clear situation script for incoming medics. Keep every Presage number exactly as written. Do not diagnose. Do not add findings that are not in the notes. Use short paragraphs.\n\n${draft.situationScript}`,
            },
          ],
        },
      ],
      config: { temperature: 0.3 },
    });

    const script = response.text?.trim();
    return NextResponse.json({
      report: script ? { ...draft, situationScript: script } : draft,
      source: script ? "gemini" : "template",
    });
  } catch {
    return NextResponse.json({ report: draft, source: "template" });
  }
}
