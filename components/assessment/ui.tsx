"use client";

import type { ReactNode } from "react";

export function Panel({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-edge bg-panel p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-[11px] font-semibold tracking-[0.18em] text-slate-400">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Choice({
  selected,
  onClick,
  children,
  tone = "neutral",
}: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
  tone?: "neutral" | "alert";
}) {
  const selectedClasses =
    tone === "alert"
      ? "border-rose-400 bg-rose-500/15 text-rose-200"
      : "border-sky-400 bg-sky-500/15 text-sky-100";

  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`flex-1 rounded-xl border px-3 py-3 text-sm font-semibold transition ${
        selected
          ? selectedClasses
          : "border-edge bg-panel-2 text-slate-300 hover:border-slate-500"
      }`}
    >
      {children}
    </button>
  );
}

export function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-edge bg-panel-2 px-3 py-3">
      <p className="text-[10px] font-semibold tracking-[0.14em] text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold tabular-nums text-slate-100">
        {value}
      </p>
    </div>
  );
}
