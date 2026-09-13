import type { AssessmentResult } from "./types";

export type SubmitOutcome = {
  delivered: boolean;
  /** Present when delivery failed; the result is still returned to the caller. */
  error?: string;
};

/**
 * Hands the completed `AssessmentResult` to Person 2.
 *
 * A missing or failing endpoint must never lose the assessment, so the result
 * is always logged and returned; the UI shows it either way.
 */
export async function submitAssessment(
  result: AssessmentResult,
): Promise<SubmitOutcome> {
  console.log("AssessmentResult", result);

  try {
    const response = await fetch(
      `/api/incidents/${encodeURIComponent(result.incidentId)}/assessment`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(result),
      },
    );
    if (!response.ok) throw new Error(`status ${response.status}`);
    return { delivered: true };
  } catch (error) {
    return {
      delivered: false,
      error: error instanceof Error ? error.message : "unknown error",
    };
  }
}
