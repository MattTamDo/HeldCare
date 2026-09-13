"use client";

import type { AssessmentResult, AssessmentState } from "@/lib/assessment/types";
import { canComplete, readiness } from "@/lib/assessment/state";
import type { SubmitOutcome } from "@/lib/assessment/submit";
import { Panel } from "./ui";

export default function CompletionPanel({
  state,
  result,
  outcome,
  submitting,
  onComplete,
}: {
  state: AssessmentState;
  result?: AssessmentResult;
  outcome?: SubmitOutcome;
  submitting: boolean;
  onComplete: () => void;
}) {
  const items = readiness(state);
  const ready = canComplete(state);

  return (
    <Panel title="ASSESSMENT READY">
      <ul className="space-y-1.5">
        {items.map((item) => (
          <li key={item.id} className="flex items-center gap-2 text-xs">
            <span
              className={
                item.done
                  ? "text-emerald-400"
                  : item.required
                    ? "text-rose-400"
                    : "text-slate-600"
              }
            >
              {item.done ? "✓" : "○"}
            </span>
            <span className={item.done ? "text-slate-300" : "text-slate-500"}>
              {item.label}
              {item.required && !item.done ? " (required)" : ""}
            </span>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={onComplete}
        disabled={!ready || submitting}
        className="mt-4 w-full rounded-xl bg-emerald-500 px-4 py-4 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
      >
        {submitting ? "SUBMITTING…" : "COMPLETE ASSESSMENT"}
      </button>

      {result ? (
        <div className="mt-4">
          <p className="mb-1.5 text-[11px] font-semibold tracking-wider text-slate-400">
            ASSESSMENT RESULT
            {outcome ? (
              <span
                className={
                  outcome.delivered
                    ? " text-emerald-400"
                    : " text-amber-400/90"
                }
              >
                {outcome.delivered
                  ? " — sent"
                  : " — held locally (endpoint unavailable)"}
              </span>
            ) : null}
          </p>
          <pre className="overflow-x-auto rounded-xl border border-edge bg-panel-2 p-3 text-[11px] leading-relaxed text-slate-300">
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      ) : null}
    </Panel>
  );
}
