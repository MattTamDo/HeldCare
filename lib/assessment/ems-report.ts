import { collectProblems } from "./state";
import {
  VISIBLE_CONCERN_LABELS,
  type AssessmentIncident,
  type AssessmentState,
} from "./types";

export type EmsReport = {
  incidentId: string;
  generatedAt: number;
  residentName: string;
  roomId: string;
  responderName: string;
  detectedAt: number;
  problems: string[];
  pulse?: number;
  respiration?: number;
  signalQuality?: string;
  responsive?: boolean;
  visibleConcern?: string;
  reportedConcern?: string;
  situationScript: string;
  disclaimer: string;
};

export function formatDetectedAt(ms: number): string {
  return new Date(ms).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function buildSituationScript(
  incident: AssessmentIncident,
  state: AssessmentState,
  transcript?: { responder?: string; copilot?: string },
): string {
  const problems = collectProblems(state);
  const time = formatDetectedAt(incident.detectedAt);
  const responsiveness =
    state.responsive === undefined
      ? "Responsiveness was not recorded."
      : state.responsive
        ? "The resident was responsive."
        : "The resident was not responsive.";
  const visible =
    state.visibleConcern === undefined
      ? "No visible concern was recorded."
      : `Visible concern: ${VISIBLE_CONCERN_LABELS[state.visibleConcern]}.`;
  const reported = state.reportedConcern
    ? `The resident reported ${state.reportedConcern}.`
    : "No reported concern was recorded.";
  const findings = problems.length
    ? problems.map((item) => `- ${item}`).join("\n")
    : "- None recorded during the live session.";
  const pulse =
    state.vitals?.pulse !== undefined
      ? `${state.vitals.pulse} bpm`
      : "not obtained";
  const breath =
    state.vitals?.respiration !== undefined
      ? `${state.vitals.respiration}/min`
      : "not obtained";
  const quality = state.vitals?.signalQuality ?? "not obtained";
  const conversation = [
    transcript?.responder
      ? `Responder said: ${transcript.responder.trim()}`
      : "",
    transcript?.copilot ? `Copilot said: ${transcript.copilot.trim()}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return [
    `SITUATION`,
    `${incident.responder.name} reached ${incident.resident.name} in room ${incident.roomId} after a fall detected at ${time}.`,
    ``,
    `SCENE`,
    responsiveness,
    visible,
    reported,
    conversation ? `\nLIVE SESSION\n${conversation}` : "",
    ``,
    `RECORDED PROBLEMS`,
    findings,
    ``,
    `PRESAGE CONTACTLESS ESTIMATES`,
    `Pulse: ${pulse}`,
    `Breathing: ${breath}`,
    `Signal quality: ${quality}`,
    ``,
    `These values are contactless estimates for handoff only. Not a diagnosis.`,
  ]
    .filter((line) => line !== "")
    .join("\n");
}

export function buildEmsReport(
  incident: AssessmentIncident,
  state: AssessmentState,
  transcript?: { responder?: string; copilot?: string },
): EmsReport {
  return {
    incidentId: incident.id,
    generatedAt: Date.now(),
    residentName: incident.resident.name,
    roomId: incident.roomId,
    responderName: incident.responder.name,
    detectedAt: incident.detectedAt,
    problems: collectProblems(state),
    pulse: state.vitals?.pulse,
    respiration: state.vitals?.respiration,
    signalQuality: state.vitals?.signalQuality,
    responsive: state.responsive,
    visibleConcern: state.visibleConcern,
    reportedConcern: state.reportedConcern,
    situationScript: buildSituationScript(incident, state, transcript),
    disclaimer:
      "Hackathon demonstration only. Situation script is compiled from the live scene, responder answers, and Presage estimates. Not medical guidance.",
  };
}
