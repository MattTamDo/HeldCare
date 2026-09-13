"use client";

import type { AssessmentState } from "@/lib/assessment/types";
import { demoProtocol, selectStep } from "@/lib/protocol";
import { Panel } from "./ui";

export default function ProtocolCard({ state }: { state: AssessmentState }) {
  const current = selectStep(state);

  return (
    <Panel title="Protocol">
      <ol className="space-y-2">
        {demoProtocol.steps.map((step, index) => {
          const active = step.id === current.id;
          return (
            <li
              key={step.id}
              className={`rounded-xl px-3 py-2.5 ${
                active
                  ? "bg-sky-50 ring-1 ring-sky-200 dark:bg-sky-500/10 dark:ring-sky-500/30"
                  : "bg-slate-50 dark:bg-slate-800/60"
              }`}
            >
              <p
                className={`text-xs font-semibold ${
                  active ? "text-sky-800 dark:text-sky-200" : "text-slate-500"
                }`}
              >
                {index + 1}. {step.title}
              </p>
              {active ? (
                <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                  {step.instruction}
                </p>
              ) : null}
            </li>
          );
        })}
      </ol>
      <p className="mt-3 text-[11px] text-slate-500">{demoProtocol.disclaimer}</p>
    </Panel>
  );
}
