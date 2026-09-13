"use client";

import { SearchIcon } from "@/components/ui/icons";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

export function AppHeader({
  query,
  onQueryChange,
  cameraCount,
  activeIncidentCount,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  cameraCount: number;
  activeIncidentCount: number;
}) {
  const calm = activeIncidentCount === 0;

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/85 backdrop-blur dark:border-slate-800 dark:bg-slate-900/85">
      <div className="mx-auto w-full max-w-[100rem] px-5 py-4">
        <p className="text-xs font-semibold tracking-[0.22em] text-sky-600 uppercase dark:text-sky-400">
          HeldCare
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <p className="flex min-w-0 flex-1 items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
            <span
              className={`size-2 shrink-0 rounded-full ${
                calm ? "animate-dot-pulse bg-emerald-500" : "animate-dot-pulse bg-rose-500"
              }`}
            />
            {calm
              ? `${cameraCount} rooms being monitored in real time`
              : `${activeIncidentCount} active alert${activeIncidentCount === 1 ? "" : "s"} — needs attention`}
          </p>

          <label className="relative min-w-0 flex-1 sm:max-w-sm">
            <span className="sr-only">Search residents and rooms</span>
            <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="Search resident or room…"
              className="w-full rounded-full border border-slate-200 bg-slate-50 py-2.5 pr-3 pl-9 text-sm outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:bg-white focus:ring-2 focus:ring-sky-100 dark:border-slate-700 dark:bg-slate-800 dark:focus:border-sky-500 dark:focus:bg-slate-800 dark:focus:ring-sky-900/40"
            />
          </label>

          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
