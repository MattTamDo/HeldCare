import type { AssessmentIncident, AssessmentState } from "@/lib/assessment/types";
import { parseTranscriptLocally } from "./local-parser";
import type { InterpretResponse } from "./tools";

/**
 * Sends a transcript to the interpret route. If the route itself is
 * unreachable, parses locally in the browser so the responder still gets
 * structured data.
 */
export async function interpretTranscript(
  transcript: string,
  incident: AssessmentIncident,
  state: AssessmentState,
): Promise<InterpretResponse> {
  try {
    const response = await fetch("/api/assessment/interpret", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transcript, incident, state }),
    });
    if (!response.ok) throw new Error(`status ${response.status}`);
    return (await response.json()) as InterpretResponse;
  } catch {
    return {
      ...parseTranscriptLocally(transcript),
      note: "Assessment service unreachable — parsed on device.",
    };
  }
}
