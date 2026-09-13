"use client";

import Link from "next/link";

import { MONITOR_TABS, type MonitorTab } from "@/lib/monitor/tabs";

const TAB_LABELS: Record<MonitorTab, string> = {
  cameras: "Live cameras",
  facility: "Facility",
  responder: "Responder",
};

export function MonitorTabNav({
  tab,
  demoMode,
  activeIncidentCount,
  hrefFor,
}: {
  tab: MonitorTab;
  demoMode: boolean;
  activeIncidentCount: number;
  hrefFor: (tab: MonitorTab) => string;
}) {
  return (
    <nav
      className="border-b border-slate-200 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-900/50"
      aria-label="Dashboard views"
    >
      <div className="mx-auto flex w-full max-w-[100rem] gap-1 overflow-x-auto px-5 py-2">
        {MONITOR_TABS.map((id) => {
          const active = tab === id;
          const badge = id !== "cameras" && activeIncidentCount > 0;
          return (
            <Link
              key={id}
              href={hrefFor(id)}
              scroll={false}
              aria-current={active ? "page" : undefined}
              className={`flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
                active
                  ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                  : "text-slate-500 hover:bg-white hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
              }`}
            >
              {TAB_LABELS[id]}
              {badge && (
                <span
                  className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold ${
                    active
                      ? "bg-rose-500 text-white"
                      : "bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-300"
                  }`}
                >
                  {activeIncidentCount}
                </span>
              )}
            </Link>
          );
        })}

        {demoMode && (
          <span className="ml-auto shrink-0 self-center rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700 ring-1 ring-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-500/30">
            Demo mode
          </span>
        )}
      </div>
    </nav>
  );
}
