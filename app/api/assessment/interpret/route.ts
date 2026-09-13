import { NextResponse } from "next/server";
import { GoogleGenAI, type Content, type Part } from "@google/genai";
import { z } from "zod";

import { getProtocol } from "@/lib/protocol";
import { parseTranscriptLocally } from "@/lib/gemini/local-parser";
import {
  READ_TOOLS,
  SYSTEM_INSTRUCTION,
  functionDeclarations,
  observationSchema,
  problemSchema,
  visualGuideSchema,
  type AssessmentAction,
  type InterpretResponse,
} from "@/lib/gemini/tools";

export const runtime = "nodejs";

const MODEL = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
const MAX_TURNS = 3;

const requestSchema = z.object({
  transcript: z.string().min(1).max(2000),
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

function stateSummary(state: Record<string, unknown>): string {
  const entries = Object.entries(state).filter(
    ([, value]) => value !== undefined && value !== null,
  );
  return entries.length
    ? entries.map(([key, value]) => `${key}: ${JSON.stringify(value)}`).join(", ")
    : "nothing recorded yet";
}

export async function POST(request: Request) {
  let body: z.infer<typeof requestSchema>;
  try {
    body = requestSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { transcript, incident, state } = body;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return NextResponse.json<InterpretResponse>({
      ...parseTranscriptLocally(transcript),
      note: "GEMINI_API_KEY is not set — using the offline parser.",
    });
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const protocol = getProtocol();

    const contents: Content[] = [
      { role: "user", parts: [{ text: transcript }] },
    ];
    const actions: AssessmentAction[] = [];
    let reply = "";

    for (let turn = 0; turn < MAX_TURNS; turn++) {
      const response = await ai.models.generateContent({
        model: MODEL,
        contents,
        config: {
          systemInstruction: [
            SYSTEM_INSTRUCTION,
            `Incident: ${incident.resident.name} in room ${incident.roomId}. Responder: ${incident.responder.name}.`,
            `Already recorded — ${stateSummary(state)}.`,
            `Protocol "${protocol.name}": ${protocol.steps
              .map((step) => `${step.id} = ${step.instruction}`)
              .join(" | ")}`,
          ].join("\n"),
          tools: [{ functionDeclarations }],
          temperature: 0,
        },
      });

      const calls = response.functionCalls ?? [];
      if (calls.length === 0) {
        reply = response.text?.trim() ?? "";
        break;
      }

      const responseParts: Part[] = [];

      for (const call of calls) {
        const name = call.name ?? "";
        const args = call.args ?? {};

        if (name === "getIncidentContext") {
          responseParts.push({
            functionResponse: { name, response: { incident } },
          });
          continue;
        }
        if (name === "getProtocol") {
          responseParts.push({
            functionResponse: { name, response: { protocol } },
          });
          continue;
        }

        if (name === "recordObservation") {
          const parsed = observationSchema.safeParse(args);
          if (parsed.success && Object.keys(parsed.data).length > 0) {
            actions.push({ tool: "recordObservation", args: parsed.data });
          }
        } else if (name === "recordProblem") {
          const parsed = problemSchema.safeParse(args);
          if (parsed.success) {
            actions.push({ tool: "recordProblem", args: parsed.data });
          }
        } else if (name === "showVisualGuide") {
          const parsed = visualGuideSchema.safeParse(args);
          if (parsed.success) {
            actions.push({ tool: "showVisualGuide", args: parsed.data });
          }
        } else if (name === "completeAssessment") {
          actions.push({ tool: "completeAssessment", args: {} });
        }

        responseParts.push({
          functionResponse: { name, response: { ok: true } },
        });
      }

      contents.push({
        role: "model",
        parts: calls.map((call) => ({ functionCall: call })),
      });
      contents.push({ role: "user", parts: responseParts });
    }

    return NextResponse.json<InterpretResponse>({
      reply: reply || "Recorded.",
      actions,
      source: "gemini",
    });
  } catch (error) {
    // A model failure must not stop the assessment — fall back to the parser.
    return NextResponse.json<InterpretResponse>({
      ...parseTranscriptLocally(transcript),
      note:
        error instanceof Error
          ? `Gemini unavailable (${error.message}) — using the offline parser.`
          : "Gemini unavailable — using the offline parser.",
    });
  }
}
