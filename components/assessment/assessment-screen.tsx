"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  incidentFromRoom,
  loadIncident,
  mockIncident,
  responderPath,
} from "@/lib/assessment/incident";
import {
  applyObservation,
  applyProblem,
  applyVideoProof,
  applyVitals,
} from "@/lib/assessment/state";
import { submitAssessment, type SubmitOutcome } from "@/lib/assessment/submit";
import {
  buildAssessmentResult,
  type AssessmentIncident,
  type AssessmentResult,
  type AssessmentState,
  type BodyRegion,
  type VideoProof,
  type Vitals,
} from "@/lib/assessment/types";
import type { Observation } from "@/lib/assessment/state";
import { interpretTranscript } from "@/lib/gemini/client";
import { useSpeechRecognition } from "@/lib/speech/use-speech-recognition";
import VisualGuide from "@/components/3d/visual-guide";

import AssessmentForm from "./assessment-form";
import CompletionPanel from "./completion-panel";
import LivePanel, { type LogEntry } from "./live-panel";
import MicButton from "./mic-button";
import ProtocolCard from "./protocol-card";
import { ResponderChrome } from "./responder-chrome";
import { Panel } from "./ui";
import VitalsPanel from "./vitals-panel";

const CONNECTOR_STEPS = [
  { id: "assessment", label: "Post-fall" },
  { id: "vitals", label: "Health vitals" },
  { id: "live", label: "Live" },
  { id: "complete", label: "Complete" },
] as const;

type ConnectorStep = (typeof CONNECTOR_STEPS)[number]["id"];

function formatElapsed(seconds: number): string {
  return seconds < 60
    ? `${seconds}s`
    : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

/**
 * Ticking "time since detection".
 *
 * Returns undefined until mounted: the server and the browser would compute
 * different values for the same render, which is a hydration mismatch.
 */
function useElapsed(from: number): string | undefined {
  const [seconds, setSeconds] = useState<number>();

  useEffect(() => {
    const tick = () =>
      setSeconds(Math.max(0, Math.round((Date.now() - from) / 1000)));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [from]);

  return seconds === undefined ? undefined : formatElapsed(seconds);
}

export default function AssessmentScreen({
  incidentId,
  roomId,
}: {
  incidentId: string;
  roomId?: string;
}) {
  const [incident, setIncident] = useState<AssessmentIncident>(
    roomId ? incidentFromRoom(incidentId, roomId) : { ...mockIncident, id: incidentId },
  );
  const [source, setSource] = useState<"api" | "mock">("mock");
  const [state, setState] = useState<AssessmentState>({});

  const [log, setLog] = useState<LogEntry[]>([]);
  const [thinking, setThinking] = useState(false);
  const [note, setNote] = useState<string>();

  const [guideOpen, setGuideOpen] = useState(false);
  const [guideRegion, setGuideRegion] = useState<BodyRegion>();

  const sinceDetected = useElapsed(incident.detectedAt);

  const [result, setResult] = useState<AssessmentResult>();
  const [outcome, setOutcome] = useState<SubmitOutcome>();
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState<ConnectorStep>("assessment");

  const logId = useRef(0);
  // Read inside async callbacks so an in-flight request always sees fresh state.
  const stateRef = useRef(state);
  stateRef.current = state;
  const incidentRef = useRef(incident);
  incidentRef.current = incident;

  useEffect(() => {
    let cancelled = false;
    loadIncident(incidentId, roomId).then((loaded) => {
      if (cancelled) return;
      setIncident(loaded.incident);
      setSource(loaded.source);
    });
    return () => {
      cancelled = true;
    };
  }, [incidentId, roomId]);

  const addLog = useCallback((role: LogEntry["role"], text: string) => {
    logId.current += 1;
    setLog((prev) => [...prev, { id: logId.current, role, text }]);
  }, []);

  const handleObservation = useCallback((observation: Observation) => {
    setState((prev) => applyObservation(prev, observation));
  }, []);

  const handleVitals = useCallback((vitals: Vitals) => {
    setState((prev) => applyVitals(prev, vitals));
  }, []);

  const handleVideoProof = useCallback((proof: VideoProof) => {
    setState((prev) => applyVideoProof(prev, proof));
  }, []);

  const handleComplete = useCallback(async () => {
    setSubmitting(true);
    const built = buildAssessmentResult(incidentRef.current.id, stateRef.current);
    setResult(built);
    setOutcome(await submitAssessment(built));
    setSubmitting(false);
  }, []);

  /** Runs a spoken or typed utterance through Gemini and applies what comes back. */
  const handleUtterance = useCallback(
    async (text: string) => {
      addLog("responder", text);
      setThinking(true);

      const response = await interpretTranscript(
        text,
        incidentRef.current,
        stateRef.current,
      );

      setNote(response.note);
      if (response.reply) addLog("assistant", response.reply);

      let shouldComplete = false;

      for (const action of response.actions) {
        if (action.tool === "recordObservation") {
          setState((prev) => applyObservation(prev, action.args));
        } else if (action.tool === "recordProblem") {
          setState((prev) => applyProblem(prev, action.args.problem));
        } else if (action.tool === "showVisualGuide") {
          setGuideRegion(action.args.region);
          setGuideOpen(true);
        } else if (action.tool === "completeAssessment") {
          shouldComplete = true;
        }
      }

      setThinking(false);
      if (shouldComplete) await handleComplete();
    },
    [addLog, handleComplete],
  );

  const speech = useSpeechRecognition(handleUtterance);

  const toggleMic = useCallback(() => {
    if (speech.listening) speech.stop();
    else speech.start();
  }, [speech]);

  function openGuide() {
    setGuideRegion(state.bodyRegion);
    setGuideOpen(true);
  }

  function closeGuide() {
    setGuideOpen(false);
    handleObservation({ guidanceViewed: true });
  }

  function stepIndex(current: ConnectorStep): number {
    return CONNECTOR_STEPS.findIndex((item) => item.id === current);
  }

  function goNext() {
    const index = stepIndex(step);
    const next = CONNECTOR_STEPS[Math.min(index + 1, CONNECTOR_STEPS.length - 1)];
    setStep(next.id);
  }

  function goBack() {
    const index = stepIndex(step);
    const previous = CONNECTOR_STEPS[Math.max(index - 1, 0)];
    setStep(previous.id);
  }

  return (
    <ResponderChrome
      incidentId={incident.id}
      residentName={incident.resident.name}
      roomId={incident.roomId}
      status={
        sinceDetected
          ? `Fall detected ${sinceDetected} ago · ${incident.responder.name}`
          : `${incident.responder.name}, ${incident.responder.role}`
      }
      active="assessment"
    >
      <div className="space-y-4">
        <div className="flex flex-wrap gap-1">
          {CONNECTOR_STEPS.map((item, index) => {
            const active = item.id === step;
            const complete = stepIndex(step) > index;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setStep(item.id)}
                className={`min-h-11 touch-manipulation rounded-full px-4 py-2 text-sm font-semibold ${
                  active
                    ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                    : complete
                      ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30"
                      : "text-slate-500 hover:bg-white hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                }`}
              >
                {item.label}
              </button>
            );
          })}
          {source === "mock" ? (
            <span className="ml-auto self-center rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700 ring-1 ring-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-500/30">
              Demo
            </span>
          ) : null}
        </div>

        {step === "assessment" ? (
          <>
            <ProtocolCard state={state} />
            <AssessmentForm
              state={state}
              onObservation={handleObservation}
              micSlot={
                <MicButton
                  listening={speech.listening}
                  supported={speech.supported}
                  onToggle={toggleMic}
                />
              }
            />
          </>
        ) : null}

        {step === "vitals" ? (
          <VitalsPanel onVitals={handleVitals} onVideoProof={handleVideoProof} />
        ) : null}

        {step === "live" ? (
          <>
            <a
              href={responderPath(incident.id, "copilot", incident.roomId)}
              className="block overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800"
            >
              <div className="relative aspect-video bg-slate-900">
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                <p className="absolute top-3 left-3 flex items-center gap-2 text-xs font-semibold text-white">
                  <span className="size-2 animate-dot-pulse rounded-full bg-rose-500" />
                  Live copilot
                </p>
              </div>
              <p className="px-4 py-3 text-sm font-semibold">
                Open phone camera copilot
              </p>
            </a>
            <LivePanel
              listening={speech.listening}
              supported={speech.supported}
              interim={speech.interim}
              error={speech.error}
              note={note}
              thinking={thinking}
              log={log}
              onToggleMic={toggleMic}
              onSubmitText={handleUtterance}
            />

            <Panel title="Visual guide">
              <p className="text-xs text-slate-500">
                {state.bodyRegion
                  ? "A reported area is available to show in 3D."
                  : "No specific area reported yet — opens a general view."}
              </p>
              <button
                type="button"
                onClick={openGuide}
                className="mt-3 w-full rounded-full bg-slate-900 px-4 py-3 text-sm font-semibold text-white dark:bg-white dark:text-slate-900"
              >
                Show visual guide
              </button>
            </Panel>
          </>
        ) : null}

        {step === "complete" ? (
          <CompletionPanel
            state={state}
            result={result}
            outcome={outcome}
            submitting={submitting}
            onComplete={handleComplete}
          />
        ) : null}

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={goBack}
            disabled={step === CONNECTOR_STEPS[0].id}
            className="min-h-12 touch-manipulation rounded-full bg-white px-4 py-3 text-sm font-semibold text-slate-600 ring-1 ring-slate-200 disabled:opacity-40 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-800"
          >
            Back
          </button>
          <button
            type="button"
            onClick={goNext}
            disabled={step === CONNECTOR_STEPS[CONNECTOR_STEPS.length - 1].id}
            className="min-h-12 touch-manipulation rounded-full bg-slate-900 px-4 py-3 text-sm font-semibold text-white disabled:bg-slate-200 disabled:text-slate-400 dark:bg-white dark:text-slate-900 dark:disabled:bg-slate-800"
          >
            Next
          </button>
        </div>
      </div>

      {guideOpen ? (
        <VisualGuide region={guideRegion} onClose={closeGuide} />
      ) : null}
    </ResponderChrome>
  );
}
