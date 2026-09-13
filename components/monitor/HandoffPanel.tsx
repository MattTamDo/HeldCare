"use client";

import { FALL_CONFIG, getMonitoredRoom } from "@/lib/fall/config";
import type { ReportedFall } from "@/lib/fall/reportFall";

function EvidenceLine({ report }: { report: ReportedFall }) {
  const evidence = report.event.evidence;
  if (!evidence) return null;

  const parts: string[] = [];
  if (evidence.torsoAngle !== undefined) {
    parts.push(`torso ${evidence.torsoAngle}°`);
  }
  if (evidence.hipVelocity !== undefined) {
    parts.push(`hip ${evidence.hipVelocity}`);
  }
  if (evidence.aspectRatio !== undefined) {
    parts.push(`aspect ${evidence.aspectRatio}`);
  }
  if (evidence.persistenceMs !== undefined) {
    parts.push(`held ${evidence.persistenceMs}ms`);
  }
  if (parts.length === 0) return null;

  return (
    <p className="mt-1 font-mono text-[10px] leading-relaxed text-slate-500">
      {parts.join(" · ")}
    </p>
  );
}

export function HandoffPanel({
  reports,
  selectedRoomId,
  onTrigger,
  onResetAll,
  onClearFeed,
}: {
  reports: ReportedFall[];
  selectedRoomId: string | null;
  onTrigger: () => void;
  onResetAll: () => void;
  onClearFeed: () => void;
}) {
  const endpoint = FALL_CONFIG.reporting.endpoint;

  return (
    <aside className="flex h-full min-h-0 flex-col gap-4">
      <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
        <h2 className="text-xs font-semibold tracking-widest text-slate-400 uppercase">
          Next stage
        </h2>
        <p className="mt-1 text-sm text-slate-300">Incident workflow handoff</p>
        <p className="mt-2 font-mono text-[11px] break-all text-slate-500">
          {endpoint
            ? `POST ${endpoint}`
            : "console only — set NEXT_PUBLIC_FALL_ENDPOINT"}
        </p>

        <div className="mt-4 space-y-2">
          <button
            type="button"
            onClick={onTrigger}
            disabled={!selectedRoomId}
            className="w-full rounded-lg border border-rose-500/50 bg-rose-500/10 px-3 py-2.5 text-sm font-semibold text-rose-200 transition hover:bg-rose-500/20 disabled:opacity-40"
          >
            Report fall
            {selectedRoomId ? ` · Room ${selectedRoomId}` : ""}
            <span className="ml-1 font-mono text-xs opacity-70">(F)</span>
          </button>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onResetAll}
              className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-slate-800"
            >
              Reset detectors
            </button>
            <button
              type="button"
              onClick={onClearFeed}
              className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-slate-800"
            >
              Clear feed
            </button>
          </div>
        </div>
      </section>

      <section className="flex min-h-0 flex-1 flex-col rounded-xl border border-slate-800 bg-slate-900/60">
        <header className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
          <h2 className="text-xs font-semibold tracking-widest text-slate-400 uppercase">
            Notifications
          </h2>
          <span className="font-mono text-sm text-slate-200">
            {reports.length}
          </span>
        </header>

        {reports.length === 0 ? (
          <p className="px-4 py-6 text-xs leading-relaxed text-slate-500">
            No fall events yet. Confirmed falls appear here and are forwarded to
            the incident workflow as a <span className="font-mono">
              FALL_DETECTED
            </span>{" "}
            event.
          </p>
        ) : (
          <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
            {reports.map((report, index) => {
              const room = getMonitoredRoom(report.event.roomId);
              const isLatest = index === 0;
              return (
                <li
                  key={`${report.event.timestamp}-${report.event.roomId}-${index}`}
                  className={`rounded-lg border p-3 ${
                    isLatest
                      ? "border-rose-500/50 bg-rose-950/30"
                      : "border-slate-800 bg-slate-950/50"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[11px] font-semibold text-rose-300">
                      FALL_DETECTED
                    </span>
                    <span className="text-[11px] text-slate-500">
                      {new Date(report.event.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="mt-1 text-sm font-semibold text-slate-100">
                    Room {report.event.roomId} · {room.residentName}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    {Math.round(report.event.confidence * 100)}% confidence ·{" "}
                    {report.trigger === "manual"
                      ? "manual trigger"
                      : "detector"}
                  </p>
                  <EvidenceLine report={report} />
                  <p className="mt-1.5 text-[11px] text-slate-500">
                    {report.outcome.delivered
                      ? "✓ delivered to incident API"
                      : `logged only — ${report.outcome.reason}`}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </aside>
  );
}
