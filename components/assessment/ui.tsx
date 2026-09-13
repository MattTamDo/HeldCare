"use client";

import type { ReactNode } from "react";

import { Card } from "@/components/ui/Card";

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
    <Card title={title} action={action} bodyClassName="space-y-3 px-4 pb-4">
      {children}
    </Card>
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
      ? "border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200"
      : "border-sky-300 bg-sky-50 text-sky-800 dark:border-sky-500/40 dark:bg-sky-500/10 dark:text-sky-200";

  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`min-h-12 flex-1 touch-manipulation rounded-xl border px-3 py-3 text-sm font-semibold ${
        selected
          ? selectedClasses
          : "border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
      }`}
    >
      {children}
    </button>
  );
}

export function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-3 ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700">
      <p className="text-[10px] font-semibold tracking-[0.14em] text-slate-500 dark:text-slate-400">
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}
