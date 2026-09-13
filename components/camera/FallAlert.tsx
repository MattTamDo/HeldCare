import type { ReportedFall } from "@/lib/fall/reportFall";

export function FallAlert({
  confidence,
  report,
}: {
  confidence: number;
  report: ReportedFall | null;
}) {
  const percent = Math.round(confidence * 100);

  return (
    <div className="animate-alert-pulse rounded-xl border border-rose-500/60 bg-rose-950/85 p-4 backdrop-blur">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-lg font-bold tracking-wide text-rose-100">
            🔴 FALL DETECTED
          </p>
          <p className="mt-0.5 text-sm text-rose-200/80">
            Confidence: {percent}%
            {report?.trigger === "manual" ? " · manual trigger" : ""}
          </p>
        </div>
        <div className="text-right text-xs text-rose-200/70">
          <p className="font-mono">FALL_DETECTED</p>
          <p>
            {report
              ? new Date(report.event.timestamp).toLocaleTimeString()
              : "emitting…"}
          </p>
        </div>
      </div>
    </div>
  );
}
