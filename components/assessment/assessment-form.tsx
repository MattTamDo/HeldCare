"use client";

import { useEffect, useState } from "react";

import type { AssessmentState, VisibleConcern } from "@/lib/assessment/types";
import type { Observation } from "@/lib/assessment/state";
import { Choice, Panel } from "./ui";

const VISIBLE_OPTIONS: Array<{ value: VisibleConcern; label: string }> = [
  { value: "none", label: "NONE OBSERVED" },
  { value: "bleeding", label: "BLEEDING" },
  { value: "other", label: "OTHER" },
];

export default function AssessmentForm({
  state,
  onObservation,
  micSlot,
}: {
  state: AssessmentState;
  onObservation: (observation: Observation) => void;
  micSlot?: React.ReactNode;
}) {
  const [concernDraft, setConcernDraft] = useState(state.reportedConcern ?? "");

  // Gemini (or the local parser) can fill this field mid-typing; keep the input
  // in step with state that arrives from outside.
  useEffect(() => {
    setConcernDraft(state.reportedConcern ?? "");
  }, [state.reportedConcern]);

  function commitConcern() {
    const next = concernDraft.trim();
    if (next !== (state.reportedConcern ?? "")) {
      onObservation({ reportedConcern: next });
    }
  }

  return (
    <Panel title="POST-FALL ASSESSMENT">
      <div className="space-y-5">
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-slate-200">
            Is the resident responsive?
          </legend>
          <div className="flex gap-2">
            <Choice
              selected={state.responsive === true}
              onClick={() => onObservation({ responsive: true })}
            >
              YES
            </Choice>
            <Choice
              tone="alert"
              selected={state.responsive === false}
              onClick={() => onObservation({ responsive: false })}
            >
              NO
            </Choice>
            <Choice
              selected={state.responsive === undefined}
              onClick={() => onObservation({ responsive: null })}
            >
              <span className="text-[11px] leading-tight">NOT RECORDED</span>
            </Choice>
          </div>
          {state.responsive === undefined ? (
            <p className="mt-2 text-xs text-slate-500">Not recorded.</p>
          ) : null}
        </fieldset>

        <fieldset>
          <legend className="mb-2 text-sm font-medium text-slate-200">
            Visible concern
          </legend>
          <div className="flex gap-2">
            {VISIBLE_OPTIONS.map((option) => (
              <Choice
                key={option.value}
                tone={option.value === "bleeding" ? "alert" : "neutral"}
                selected={state.visibleConcern === option.value}
                onClick={() => onObservation({ visibleConcern: option.value })}
              >
                <span className="text-[11px] leading-tight">{option.label}</span>
              </Choice>
            ))}
          </div>
        </fieldset>

        <div>
          <label
            htmlFor="reported-concern"
            className="mb-2 block text-sm font-medium text-slate-200"
          >
            Reported concern
          </label>
          <p className="mb-2 text-xs text-slate-500">
            What the resident says is wrong, in their words.
          </p>
          <div className="flex gap-2">
            <input
              id="reported-concern"
              value={concernDraft}
              onChange={(event) => setConcernDraft(event.target.value)}
              onBlur={commitConcern}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.currentTarget.blur();
                }
              }}
              placeholder="e.g. left hip pain"
              className="min-w-0 flex-1 rounded-xl border border-edge bg-panel-2 px-3 py-3 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-sky-400"
            />
            {micSlot}
          </div>
        </div>
      </div>
    </Panel>
  );
}
