import protocol from "@/data/demo-fall-protocol.json";
import type { AssessmentState } from "@/lib/assessment/types";

export type ProtocolStep = {
  id: string;
  title: string;
  condition: string;
  instruction: string;
  visualKey: string;
};

export type Protocol = {
  name: string;
  disclaimer: string;
  steps: ProtocolStep[];
};

export const demoProtocol: Protocol = protocol as Protocol;

export function getProtocol(): Protocol {
  return demoProtocol;
}

export function getStep(id: string): ProtocolStep | undefined {
  return demoProtocol.steps.find((step) => step.id === id);
}

/**
 * Deterministic step selection — no model involved.
 *
 * Gemini may read this protocol but never invents instructions; the current
 * step is always a pure function of recorded assessment state.
 */
export function selectStep(state: AssessmentState): ProtocolStep {
  const fallback = demoProtocol.steps[0];

  // Nothing recorded yet — start at the top.
  if (state.responsive === undefined) {
    return getStep("responsiveness") ?? fallback;
  }
  // An unresponsive resident or visible bleeding outranks the rest.
  if (state.responsive === false || state.visibleConcern === "bleeding") {
    return getStep("escalation") ?? fallback;
  }
  // Responsiveness is on file, so the next thing to do is record the concern —
  // whether or not one has been captured yet.
  return getStep("concern") ?? fallback;
}
