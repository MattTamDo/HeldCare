"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { loadIncident, mockIncident } from "@/lib/assessment/incident";
import { applyObservation, applyVitals } from "@/lib/assessment/state";
import { submitAssessment, type SubmitOutcome } from "@/lib/assessment/submit";
import {
  buildAssessmentResult,
  type AssessmentIncident,
  type AssessmentResult,
  type AssessmentState,
  type BodyRegion,
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
import { Panel } from "./ui";
import VitalsPanel from "./vitals-panel";

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

export default function AssessmentScreen({ incidentId }: { incidentId: string }) {
  const [incident, setIncident] = useState<AssessmentIncident>({
    ...mockIncident,
    id: incidentId,
  });
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

  const logId = useRef(0);
  // Read inside async callbacks so an in-flight request always sees fresh state.
  const stateRef = useRef(state);
  stateRef.current = state;
  const incidentRef = useRef(incident);
  incidentRef.current = incident;

  useEffect(() => {
    let cancelled = false;
    loadIncident(incidentId).then((loaded) => {
      if (cancelled) return;
      setIncident(loaded.incident);
      setSource(loaded.source);
    });
    return () => {
      cancelled = true;
    };
  }, [incidentId]);

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

  return (
    <main className="mx-auto w-full max-w-md px-4 pb-10 pt-5">
      <header className="mb-4">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-[11px] font-semibold tracking-[0.2em] text-sky-400">
            CAREFALL
          </p>
          <p className="text-[11px] text-slate-500">
            {source === "mock" ? "mock incident" : `incident ${incident.id}`}
          </p>
        </div>
        <h1 className="mt-1 text-2xl font-semibold leading-tight">
          {incident.resident.name}
        </h1>
        <p className="mt-0.5 text-sm text-slate-400">
          Room {incident.roomId} · Responder {incident.responder.name},{" "}
          {incident.responder.role}
        </p>
        <p className="mt-0.5 text-xs tabular-nums text-slate-500">
          {sinceDetected ? `Fall detected ${sinceDetected} ago` : " "}
        </p>
      </header>

      <div className="space-y-3">
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

        <VitalsPanel onVitals={handleVitals} />

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

        <Panel title="VISUAL GUIDE">
          <p className="text-xs text-slate-400">
            {state.bodyRegion
              ? "A reported area is available to show in 3D."
              : "No specific area reported yet — opens a general view."}
          </p>
          <button
            type="button"
            onClick={openGuide}
            className="mt-3 w-full rounded-xl border border-edge bg-panel-2 px-4 py-3 text-sm font-semibold text-slate-200 transition hover:border-slate-500"
          >
            SHOW VISUAL GUIDE
          </button>
        </Panel>

        <CompletionPanel
          state={state}
          result={result}
          outcome={outcome}
          submitting={submitting}
          onComplete={handleComplete}
        />
      </div>

      {guideOpen ? (
        <VisualGuide region={guideRegion} onClose={() => setGuideOpen(false)} />
      ) : null}
    </main>
  );
}
