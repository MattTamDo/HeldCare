import { Modality, type LiveConnectConfig } from "@google/genai";

import type { AssessmentIncident, AssessmentState } from "@/lib/assessment/types";
import { collectProblems } from "@/lib/assessment/state";

import { LIVE_SYSTEM_INSTRUCTION, functionDeclarations } from "./tools";

export const GEMINI_LIVE_MODELS = [
  "gemini-3.1-flash-live-preview",
  "gemini-2.5-flash-native-audio-preview-12-2025",
] as const;

export function liveModelName(): string {
  return (
    process.env.GEMINI_LIVE_MODEL ??
    process.env.NEXT_PUBLIC_GEMINI_LIVE_MODEL ??
    GEMINI_LIVE_MODELS[0]
  );
}

export function liveSystemInstruction(
  incident: AssessmentIncident,
  state: AssessmentState,
): string {
  const pulse = state.vitals?.pulse;
  const respiration = state.vitals?.respiration;
  const problems = collectProblems(state);

  return [
    LIVE_SYSTEM_INSTRUCTION,
    `Resident: ${incident.resident.name}, room ${incident.roomId}. Responder: ${incident.responder.name}.`,
    pulse || respiration
      ? `Latest contactless estimates (context only, not a diagnosis): pulse ${pulse ?? "n/a"} bpm, breathing ${respiration ?? "n/a"}/min, signal ${state.vitals?.signalQuality ?? "n/a"}.`
      : "No contactless measurement yet.",
    problems.length
      ? `Already saved findings: ${problems.join("; ")}.`
      : "No findings saved yet.",
    "Hackathon demonstration only. Not medical guidance.",
  ].join("\n");
}

export function liveConnectConfig(
  incident: AssessmentIncident,
  state: AssessmentState,
): LiveConnectConfig {
  return {
    responseModalities: [Modality.AUDIO],
    systemInstruction: liveSystemInstruction(incident, state),
    tools: [{ functionDeclarations }],
    inputAudioTranscription: {},
    outputAudioTranscription: {},
    temperature: 0.7,
  };
}

export function stateBriefing(
  incident: AssessmentIncident,
  state: AssessmentState,
): string {
  const problems = collectProblems(state);
  return [
    `Look at the live camera now. Resident ${incident.resident.name} in room ${incident.roomId}.`,
    problems.length
      ? `The responder has already noted: ${problems.join("; ")}.`
      : "Nothing has been recorded yet.",
    state.vitals?.pulse
      ? `Contactless estimates in the background: pulse ${state.vitals.pulse}, breathing ${state.vitals.respiration ?? "n/a"}.`
      : "",
    "Describe what you see and coach the next action from the scene. Then wait for the responder to speak. Do not read a script.",
  ]
    .filter(Boolean)
    .join(" ");
}
