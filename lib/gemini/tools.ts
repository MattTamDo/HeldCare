import { Type, type FunctionDeclaration } from "@google/genai";
import { z } from "zod";

/**
 * Gemini has exactly one job here: turn what the responder says into structured
 * assessment data and move through the demo protocol. No diagnosis, no agents,
 * no invented procedure. See module 3 spec, "Gemini role".
 */
export const SYSTEM_INSTRUCTION = `You are CareFall Live, a hands-free assistant for a care responder who is already at the resident's side after a fall.

Your only job is to (1) record what the responder observes as structured data and (2) read back the facility's demo protocol.

Rules:
- Never diagnose. Never confirm or rule out a fracture, stroke, concussion, or any other condition.
- Never prescribe treatment and never invent a procedure or instruction that is not in the protocol you are given.
- Record what the resident *reports* and what the responder *observes* — nothing inferred.
- Call recordObservation as soon as you have any observation. Do not wait for a complete picture.
- When the situation is not covered by the protocol, tell the responder to escalate according to facility policy.
- Keep spoken replies to one short sentence. The responder is busy.`;

export const functionDeclarations: FunctionDeclaration[] = [
  {
    name: "recordObservation",
    description:
      "Record an observation onto the assessment form. Call with only the fields you actually heard.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        responsive: {
          type: Type.BOOLEAN,
          description: "True if the resident is awake and responding.",
        },
        visibleConcern: {
          type: Type.STRING,
          enum: ["none", "bleeding", "other"],
          description: "Something the responder can see, not something reported.",
        },
        reportedConcern: {
          type: Type.STRING,
          description:
            "What the resident says is wrong, in their terms, e.g. 'left hip pain'. Not a diagnosis.",
        },
      },
    },
  },
  {
    name: "getIncidentContext",
    description:
      "Get the resident, room, responder, and timing for the incident being assessed.",
    parameters: { type: Type.OBJECT, properties: {} },
  },
  {
    name: "getProtocol",
    description:
      "Get the facility's demo fall-response protocol steps. Use this instead of inventing instructions.",
    parameters: { type: Type.OBJECT, properties: {} },
  },
  {
    name: "showVisualGuide",
    description:
      "Open the 3D visual guide highlighting a body region the resident mentioned.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        region: {
          type: Type.STRING,
          enum: [
            "head",
            "torso",
            "pelvis",
            "left-arm",
            "right-arm",
            "left-leg",
            "right-leg",
          ],
        },
      },
    },
  },
  {
    name: "completeAssessment",
    description:
      "Finish the assessment. Only call this when the responder explicitly says they are done.",
    parameters: { type: Type.OBJECT, properties: {} },
  },
];

/** Tools the server answers itself; the rest become UI actions. */
export const READ_TOOLS = new Set(["getIncidentContext", "getProtocol"]);

export const observationSchema = z.object({
  responsive: z.boolean().optional(),
  visibleConcern: z.enum(["none", "bleeding", "other"]).optional(),
  reportedConcern: z.string().min(1).optional(),
});

export const visualGuideSchema = z.object({
  region: z
    .enum([
      "head",
      "torso",
      "pelvis",
      "left-arm",
      "right-arm",
      "left-leg",
      "right-leg",
    ])
    .optional(),
});

export type AssessmentAction =
  | { tool: "recordObservation"; args: z.infer<typeof observationSchema> }
  | { tool: "showVisualGuide"; args: z.infer<typeof visualGuideSchema> }
  | { tool: "completeAssessment"; args: Record<string, never> };

export type InterpretResponse = {
  reply: string;
  actions: AssessmentAction[];
  /** "gemini" when the model answered, "local" when the offline parser did. */
  source: "gemini" | "local";
  note?: string;
};
