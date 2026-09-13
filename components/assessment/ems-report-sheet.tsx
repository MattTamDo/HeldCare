"use client";

import type { EmsReport } from "@/lib/assessment/ems-report";
import { formatDetectedAt } from "@/lib/assessment/ems-report";

export default function EmsReportSheet({
  report,
  writing,
  delivered,
  onClose,
  onSend,
}: {
  report: EmsReport;
  writing?: boolean;
  delivered?: boolean;
  onClose: () => void;
  onSend: () => void;
}) {
  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-slate-900/40 px-4 py-6 backdrop-blur-sm dark:bg-slate-950/70">
      <section className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col overflow-hidden rounded-2xl bg-white text-slate-900 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-100 dark:ring-slate-800">
        <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <div>
            <p className="text-xs font-semibold tracking-[0.18em] text-sky-600 uppercase dark:text-sky-400">
              EMS situation report
            </p>
            <h2 className="mt-1 text-lg font-bold">{report.residentName}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-3 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            Close
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4 text-sm">
          <p className="text-slate-500">
            Room {report.roomId} · fall at {formatDetectedAt(report.detectedAt)} ·{" "}
            {report.responderName}
          </p>

          <div>
            <p className="text-xs font-semibold tracking-[0.16em] text-slate-500 uppercase">
              Presage estimates
            </p>
            <div className="mt-2 grid grid-cols-3 gap-2">
              <Vital label="Pulse" value={report.pulse ? `${report.pulse}` : "—"} />
              <Vital label="Breath" value={report.respiration ? `${report.respiration}` : "—"} />
              <Vital label="Signal" value={report.signalQuality ?? "—"} />
            </div>
          </div>

          <div className="rounded-xl bg-sky-50 px-3 py-3 ring-1 ring-sky-200 dark:bg-sky-500/10 dark:ring-sky-500/30">
            <p className="text-xs font-semibold tracking-[0.16em] text-sky-700 uppercase dark:text-sky-300">
              Situation script
            </p>
            {writing ? (
              <p className="mt-2 text-slate-500">Writing the situation report…</p>
            ) : (
              <pre className="mt-2 whitespace-pre-wrap font-sans text-sm leading-relaxed">
                {report.situationScript}
              </pre>
            )}
          </div>

          {report.problems.length > 0 ? (
            <div>
              <p className="text-xs font-semibold tracking-[0.16em] text-slate-500 uppercase">
                Saved problems
              </p>
              <ul className="mt-2 space-y-2">
                {report.problems.map((problem) => (
                  <li
                    key={problem}
                    className="rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700"
                  >
                    {problem}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <p className="text-[11px] leading-relaxed text-slate-500">{report.disclaimer}</p>
        </div>

        <div className="border-t border-slate-200 p-4 dark:border-slate-800">
          <button
            type="button"
            onClick={onSend}
            disabled={writing}
            className="w-full rounded-full bg-slate-900 py-3 text-sm font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-slate-900"
          >
            {delivered ? "Report saved" : "Send report to EMS"}
          </button>
        </div>
      </section>
    </div>
  );
}

function Vital({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-3 ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700">
      <p className="text-[10px] tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}
