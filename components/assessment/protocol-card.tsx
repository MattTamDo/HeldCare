"use client";

import type { AssessmentState } from "@/lib/assessment/types";
import { demoProtocol, selectStep } from "@/lib/protocol";
import { Panel } from "./ui";

export default function ProtocolCard({ state }: { state: AssessmentState }) {
  const current = selectStep(state);

  return (
    <Panel title="PROTOCOL">
      <ol className="space-y-2">
        {demoProtocol.steps.map((step, index) => {
          const active = step.id === current.id;
          return (
            <li
              key={step.id}
              className={`rounded-xl border px-3 py-2.5 ${
                active
                  ? "border-sky-400/50 bg-sky-500/10"
                  : "border-transparent bg-panel-2/50"
              }`}
            >
              <p
                className={`text-xs font-semibold ${
                  active ? "text-sky-200" : "text-slate-400"
                }`}
              >
                {index + 1}. {step.title}
              </p>
              {active ? (
                <p className="mt-1 text-xs leading-relaxed text-slate-300">
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
