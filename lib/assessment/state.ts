import { regionFromConcern, visualKeyFromConcern } from "./body-region";
import type { AssessmentState, Vitals, VisibleConcern } from "./types";
import { selectStep } from "@/lib/protocol";

export type Observation = {
  responsive?: boolean;
  visibleConcern?: VisibleConcern;
  reportedConcern?: string;
};

/**
 * Single place where assessment state changes.
 *
 * Derived fields (`bodyRegion`, `visualKey`, `protocolStep`) are recomputed
 * from the recorded facts every time, so the 3D highlight and the protocol step
 * can never drift out of sync with the form.
 */
export function applyObservation(
  state: AssessmentState,
  observation: Observation,
): AssessmentState {
  const merged: AssessmentState = { ...state };

  if (observation.responsive !== undefined) {
    merged.responsive = observation.responsive;
  }
  if (observation.visibleConcern !== undefined) {
    merged.visibleConcern = observation.visibleConcern;
  }
  if (observation.reportedConcern !== undefined) {
    merged.reportedConcern = observation.reportedConcern;
  }

  return derive(merged);
}

export function applyVitals(state: AssessmentState, vitals: Vitals): AssessmentState {
  return derive({ ...state, vitals });
}

function derive(state: AssessmentState): AssessmentState {
  return {
    ...state,
    bodyRegion: regionFromConcern(state.reportedConcern),
    visualKey: visualKeyFromConcern(state.reportedConcern),
    protocolStep: selectStep(state).id,
  };
}

/** Checklist shown before COMPLETE ASSESSMENT. */
export function readiness(state: AssessmentState) {
  return [
    {
      id: "responsive",
      label: "Responsiveness recorded",
      done: state.responsive !== undefined,
      required: true,
    },
    {
      id: "visible",
      label: "Visible concern recorded",
      done: state.visibleConcern !== undefined,
      required: false,
    },
    {
      id: "reported",
      label: "Reported concern recorded",
      done: Boolean(state.reportedConcern),
      required: false,
    },
    {
      id: "vitals",
      label: "Contactless measurement taken",
      done: Boolean(state.vitals?.pulse),
      required: false,
    },
  ];
}

/** Only responsiveness gates completion; everything else is optional. */
export function canComplete(state: AssessmentState): boolean {
  return readiness(state)
    .filter((item) => item.required)
    .every((item) => item.done);
}
