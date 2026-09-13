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
  applyVitals,
  collectProblems,
} from "@/lib/assessment/state";
import { buildEmsReport, type EmsReport } from "@/lib/assessment/ems-report";
import { submitAssessment } from "@/lib/assessment/submit";
import {
  buildAssessmentResult,
  type AssessmentIncident,
  type AssessmentState,
  type BodyRegion,
} from "@/lib/assessment/types";
import type { AssessmentAction } from "@/lib/gemini/tools";
import { createVitalsProvider } from "@/lib/vitals";
import VisualGuide from "@/components/3d/visual-guide";

import EmsReportSheet from "./ems-report-sheet";
import GeminiLiveCopilot from "./gemini-live-copilot";

export default function PhoneCopilotScreen({
  incidentId,
  roomId,
}: {
  incidentId: string;
  roomId?: string;
}) {
  const [incident, setIncident] = useState<AssessmentIncident>(
    roomId ? incidentFromRoom(incidentId, roomId) : { ...mockIncident, id: incidentId },
  );
  const [state, setState] = useState<AssessmentState>({});
  const [guideOpen, setGuideOpen] = useState(false);
  const [guideRegion, setGuideRegion] = useState<BodyRegion>();
  const [problemsOpen, setProblemsOpen] = useState(false);
  const [report, setReport] = useState<EmsReport>();
  const [writing, setWriting] = useState(false);
  const [delivered, setDelivered] = useState(false);
  const incidentRef = useRef(incident);
  const stateRef = useRef(state);
  incidentRef.current = incident;
  stateRef.current = state;

  useEffect(() => {
    let cancelled = false;
    loadIncident(incidentId, roomId).then((loaded) => {
      if (!cancelled) setIncident(loaded.incident);
    });
    return () => {
      cancelled = true;
    };
  }, [incidentId, roomId]);

  useEffect(() => {
    const provider = createVitalsProvider();
    const unsubscribe = provider.subscribe?.((snapshot) => {
      if (snapshot.stage === "available" && snapshot.vitals.pulse) {
        setState((prev) => applyVitals(prev, snapshot.vitals));
      }
    });
    void provider.start();
    return () => {
      unsubscribe?.();
      void provider.stop();
    };
  }, []);

  const generateReport = useCallback(
    async (transcript?: { inputText: string; outputText: string }) => {
      const notes = {
        responder: transcript?.inputText,
        copilot: transcript?.outputText,
      };
      const draft = buildEmsReport(incidentRef.current, stateRef.current, notes);
      setReport(draft);
      setWriting(true);
      setDelivered(false);

      try {
        const response = await fetch("/api/assessment/ems-report", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            incident: incidentRef.current,
            state: stateRef.current,
            transcript: notes,
          }),
        });
        if (response.ok) {
          const body = (await response.json()) as { report?: EmsReport };
          if (body.report) setReport(body.report);
        }
      } finally {
        setWriting(false);
      }
    },
    [],
  );

  const handleAction = useCallback(
    async (action: AssessmentAction) => {
      if (action.tool === "recordObservation") {
        setState((prev) => applyObservation(prev, action.args));
      } else if (action.tool === "recordProblem") {
        setState((prev) => applyProblem(prev, action.args.problem));
      } else if (action.tool === "showVisualGuide") {
        setGuideRegion(action.args.region);
        setGuideOpen(true);
      } else if (action.tool === "completeAssessment") {
        await generateReport();
      }
    },
    [generateReport],
  );

  async function sendReport() {
    if (!report) return;
    const result = buildAssessmentResult(incident.id, state);
    const outcome = await submitAssessment({
      ...result,
      problems: report.problems,
      reportedConcern: result.reportedConcern ?? report.reportedConcern,
      vitals: {
        pulse: report.pulse,
        respiration: report.respiration,
        signalQuality: report.signalQuality,
      },
    });
    setDelivered(outcome.delivered);
  }

  const problems = collectProblems(state);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-4">
      <p className="text-[11px] font-semibold tracking-[0.22em] text-sky-600 uppercase">
        HeldCare
      </p>
      <h1 className="mt-1 text-lg font-bold">{incident.resident.name}</h1>
      <p className="text-sm text-slate-500">Room {incident.roomId} · Live copilot</p>
      <div className="mt-3 flex gap-3 text-sm font-semibold">
        <a href={`/monitor?tab=responder`} className="text-slate-500 underline">
          Dashboard
        </a>
        <a
          href={responderPath(incident.id, "assessment", incident.roomId)}
          className="text-slate-500 underline"
        >
          Assessment
        </a>
      </div>

      <div className="mt-4">
      <GeminiLiveCopilot
        incident={incident}
        state={state}
        onAction={handleAction}
        onOpenProblems={() => setProblemsOpen(true)}
        onOpenReport={() => {
          void generateReport();
        }}
        onEnded={(session) => {
          void generateReport(session);
        }}
      />

      {problemsOpen ? (
        <div className="fixed inset-0 z-30 flex flex-col justify-end bg-slate-900/40 backdrop-blur-sm dark:bg-slate-950/70">
          <section className="mx-auto w-full max-w-3xl rounded-t-2xl bg-white px-5 pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold">Saved problems</p>
              <button
                type="button"
                onClick={() => setProblemsOpen(false)}
                className="rounded-full px-3 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Done
              </button>
            </div>
            {problems.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500">
                Findings the copilot hears or sees will collect here.
              </p>
            ) : (
              <ul className="mt-4 space-y-2">
                {problems.map((problem) => (
                  <li
                    key={problem}
                    className="rounded-xl bg-slate-50 px-3 py-2 text-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700"
                  >
                    {problem}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      ) : null}

      {report ? (
        <EmsReportSheet
          report={report}
          writing={writing}
          delivered={delivered}
          onClose={() => setReport(undefined)}
          onSend={sendReport}
        />
      ) : null}

      {guideOpen ? (
        <VisualGuide
          region={guideRegion}
          onClose={() => {
            setGuideOpen(false);
            setState((prev) => applyObservation(prev, { guidanceViewed: true }));
          }}
        />
      ) : null}
      </div>
    </div>
  );
}
