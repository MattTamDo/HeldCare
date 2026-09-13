/**
 * Module 3 — Post-Fall Assessment types.
 *
 * `AssessmentResult` is the integration contract with Person 2.
 * Do not change its shape without coordinating with Person 2 (see PLAN.md).
 */

export type IncidentStatus =
  | "detected"
  | "responding"
  | "arrived"
  | "assessing"
  | "resolved";

export type AssessmentIncident = {
  id: string;
  roomId: string;
  resident: { id: string; name: string };
  responder: { id: string; name: string; role: string };
  status: IncidentStatus;
  detectedAt: number;
  arrivedAt?: number;
};

export type Vitals = {
  pulse?: number;
  respiration?: number;
  signalQuality?: string;
  pressureWaveform?: number[];
  hrv?: {
    rmssd?: number;
    meanNn?: number;
    sdnn?: number;
    baevsky?: number;
    stable?: boolean;
    confidence?: number;
  };
  face?: {
    blinking?: boolean;
    talking?: boolean;
    expression?: string;
    landmarksCount?: number;
  };
  packets?: number;
  scanSeconds?: number;
};

export type AssessmentResultVitals = Pick<
  Vitals,
  "pulse" | "respiration" | "signalQuality"
>;

/** Regions the procedural mannequin can highlight. */
export type BodyRegion =
  | "head"
  | "torso"
  | "pelvis"
  | "left-arm"
  | "right-arm"
  | "left-leg"
  | "right-leg";

export type VisibleConcern = "none" | "bleeding" | "other";

export type AssessmentState = {
  responsive?: boolean;
  visibleConcern?: VisibleConcern;
  reportedConcern?: string;
  vitals?: Vitals;
  protocolStep?: string;
  visualKey?: string;
  guidanceViewed?: boolean;
  /** Derived from `reportedConcern`; drives the 3D highlight. */
  bodyRegion?: BodyRegion;
};

/** Contract handed to Person 2 via POST /api/incidents/:id/assessment. */
export type AssessmentResult = {
  incidentId: string;
  responsive?: boolean;
  reportedConcern?: string;
  visibleConcern?: string;
  vitals?: AssessmentResultVitals;
  completedAt: number;
};

export const VISIBLE_CONCERN_LABELS: Record<VisibleConcern, string> = {
  none: "None observed",
  bleeding: "Bleeding",
  other: "Other",
};

export const BODY_REGION_LABELS: Record<BodyRegion, string> = {
  head: "Head",
  torso: "Torso",
  pelvis: "Hip / pelvis",
  "left-arm": "Left arm",
  "right-arm": "Right arm",
  "left-leg": "Left leg",
  "right-leg": "Right leg",
};

export function buildAssessmentResult(
  incidentId: string,
  state: AssessmentState,
): AssessmentResult {
  const vitals =
    state.vitals &&
    (state.vitals.pulse !== undefined ||
      state.vitals.respiration !== undefined ||
      state.vitals.signalQuality !== undefined)
      ? {
          pulse: state.vitals.pulse,
          respiration: state.vitals.respiration,
          signalQuality: state.vitals.signalQuality,
        }
      : undefined;

  return {
    incidentId,
    responsive: state.responsive,
    reportedConcern: state.reportedConcern,
    visibleConcern: state.visibleConcern,
    vitals,
    completedAt: Date.now(),
  };
}
