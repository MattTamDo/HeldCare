import type { FallSourceStatus } from "@/hooks/useFallSource";
import type { FallState } from "@/lib/fall/types";

type Tone = "idle" | "good" | "warn" | "alert";

const TONE_STYLES: Record<Tone, string> = {
  idle: "border-slate-700 bg-slate-900/80 text-slate-300",
  good: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  warn: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  alert: "border-rose-500/50 bg-rose-500/15 text-rose-200",
};

const DOT_STYLES: Record<Tone, string> = {
  idle: "bg-slate-500",
  good: "bg-emerald-400",
  warn: "bg-amber-400",
  alert: "bg-rose-400",
};

export function describeMonitorState(
  status: FallSourceStatus,
  fallState: FallState,
): { label: string; tone: Tone } {
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
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold tracking-wide uppercase backdrop-blur ${TONE_STYLES[tone]}`}
    >
      <span
        className={`size-2 rounded-full ${DOT_STYLES[tone]} ${animate ? "animate-dot-pulse" : ""}`}
      />
      {label}
    </span>
  );
}
