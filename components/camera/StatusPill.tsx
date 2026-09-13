import type { FallSourceStatus } from "@/hooks/useFallSource";
import type { FallState } from "@/lib/fall/types";

export type StatusTone = "idle" | "good" | "warn" | "alert";

const TONE_STYLES: Record<StatusTone, string> = {
  idle: "bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700",
  good: "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30",
  warn: "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30",
  alert:
    "bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/30",
};

const DOT_STYLES: Record<StatusTone, string> = {
  idle: "bg-slate-400",
  good: "bg-emerald-500",
  warn: "bg-amber-500",
  alert: "bg-rose-500",
};

export function describeMonitorState(
  status: FallSourceStatus,
  fallState: FallState,
): { label: string; tone: StatusTone } {
  if (fallState === "CONFIRMED_FALL") {
    return { label: "Fall detected", tone: "alert" };
  }
  if (status === "error") return { label: "Camera error", tone: "alert" };
  if (status === "idle") return { label: "Camera off", tone: "idle" };
  if (status === "starting") return { label: "Starting camera", tone: "idle" };

  switch (fallState) {
    case "DESCENDING":
      return { label: "Rapid movement", tone: "warn" };
    case "POSSIBLE_FALL":
      return { label: "Possible fall", tone: "warn" };
    default:
      return { label: "Monitoring", tone: "good" };
  }
}

export function StatusPill({
  status,
  fallState,
}: {
  status: FallSourceStatus;
  fallState: FallState;
}) {
  const { label, tone } = describeMonitorState(status, fallState);
  const animate = tone === "good" || tone === "alert";

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ring-1 ${TONE_STYLES[tone]}`}
    >
      <span
        className={`size-2 rounded-full ${DOT_STYLES[tone]} ${animate ? "animate-dot-pulse" : ""}`}
      />
      {label}
    </span>
  );
}
