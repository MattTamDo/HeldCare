import { regionFromConcern } from "@/lib/assessment/body-region";
import type { z } from "zod";
import type { AssessmentAction, InterpretResponse, observationSchema } from "./tools";

type Observation = z.infer<typeof observationSchema>;

/**
 * Rule-based stand-in for Gemini.
 *
 * Used when `GEMINI_API_KEY` is absent or the API call fails, so a demo can be
 * given with no network and no key. It handles the phrasings the demo script
 * uses; it is deliberately narrow rather than clever.
 */

const BODY_PARTS = [
  "hip", "head", "shoulder", "elbow", "wrist", "hand", "arm",
  "knee", "ankle", "foot", "thigh", "shin", "leg",
  "back", "chest", "rib", "ribs", "neck", "stomach", "abdomen", "pelvis",
];

const PAIN_WORDS = /\b(hurts?|hurting|pain|painful|sore|ache|aching|aches)\b/;

const UNRESPONSIVE =
  /\b(unresponsive|unconscious|not responsive|not responding|no response|isn'?t responding|won'?t respond|out cold)\b/;

const RESPONSIVE =
  /\b(responsive|responding|awake|alert|conscious|talking|answering|answered|says|said|told me)\b/;

function extractConcern(text: string): string | undefined {
  if (!PAIN_WORDS.test(text)) return undefined;

  const pattern = new RegExp(
    `\\b(left|right)?\\s*(${BODY_PARTS.join("|")})\\b`,
    "i",
  );
  const match = text.match(pattern);
  if (!match) return undefined;

  const side = match[1] ? `${match[1].toLowerCase()} ` : "";
  return `${side}${match[2].toLowerCase()} pain`;
}

export function parseTranscriptLocally(transcript: string): InterpretResponse {
  const text = transcript.toLowerCase();
  const args: Observation = {};

  if (UNRESPONSIVE.test(text)) {
    args.responsive = false;
  } else if (RESPONSIVE.test(text)) {
    args.responsive = true;
  }

  if (/\bbleed(ing)?\b|\bblood\b/.test(text)) {
    args.visibleConcern = "bleeding";
  } else if (/\bno visible\b|\bnothing visible\b|\bno injuries visible\b/.test(text)) {
    args.visibleConcern = "none";
  }

  const concern = extractConcern(text);
  if (concern) args.reportedConcern = concern;

  const actions: AssessmentAction[] = [];
  if (Object.keys(args).length > 0) {
    actions.push({ tool: "recordObservation", args });
  }

  const region = regionFromConcern(concern);
  if (region) {
    actions.push({ tool: "showVisualGuide", args: { region } });
  }

  return {
    reply: actions.length
      ? "Recorded. Escalate according to facility protocol."
      : "I didn't catch an observation there — you can type it into the form.",
    actions,
    source: "local",
  };
}
