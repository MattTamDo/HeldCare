"use client";

import { useState } from "react";

import { Card } from "@/components/ui/Card";
import { CheckIcon, CheckShieldIcon, PhoneIcon } from "@/components/ui/icons";
import type { useIncidentBoard } from "@/hooks/useIncidentBoard";

export function ResponderAlerts({
  board,
}: {
  board: ReturnType<typeof useIncidentBoard>;
}) {
  const [busy, setBusy] = useState(false);
  const { activeIncident: incident, activeRoom, board: data } = board;

  async function claim(responderId: string) {
    setBusy(true);
    await board.respond(responderId);
    setBusy(false);
  }

  async function finish() {
    setBusy(true);
    await board.resolve();
    setBusy(false);
  }

  if (!incident) {
    return (
      <div className="mx-auto w-full max-w-3xl px-5 py-10">
        <Card bodyClassName="flex flex-col items-center gap-3 px-6 py-14 text-center">
          <span className="grid size-14 place-items-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300">
            <CheckShieldIcon className="size-7" />
          </span>
          <p className="text-lg font-bold">No active alerts</p>
          <p className="max-w-sm text-sm text-slate-500 dark:text-slate-400">
            When a camera confirms a fall, the alert appears here with one-tap
            dispatch for the responder on shift.
          </p>
        </Card>
      </div>
    );
  }

  const claimed = incident.status === "responding";

  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-8">
      <section
        className={`animate-alert-pulse overflow-hidden rounded-3xl p-8 text-center shadow-sm ring-2 ${
          claimed
            ? "bg-amber-50 ring-amber-300 dark:bg-amber-500/10 dark:ring-amber-500/40"
            : "bg-rose-50 ring-rose-300 dark:bg-rose-500/10 dark:ring-rose-500/40"
        }`}
      >
        <p
          className={`text-2xl font-bold ${
            claimed
              ? "text-amber-900 dark:text-amber-200"
              : "text-rose-900 dark:text-rose-200"
          }`}
        >
          {claimed ? "Responder en route" : "Fall detected"}
        </p>
        <p className="mt-1 text-lg font-medium">
          Room {activeRoom?.id}
          {activeRoom?.residentName ? ` — ${activeRoom.residentName}` : ""}
        </p>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Detected at{" "}
          {new Date(incident.detectedAt).toLocaleTimeString([], {
            hour: "numeric",
            minute: "2-digit",
          })}{" "}
          · {Math.round(incident.fallConfidence * 100)}% confidence
        </p>

        {claimed ? (
          <>
            <p className="mt-4 text-sm font-semibold text-amber-800 dark:text-amber-300">
              {incident.responderName} is on the way
            </p>
            <button
              type="button"
              onClick={finish}
              disabled={busy}
              className="mx-auto mt-5 flex items-center gap-2 rounded-2xl bg-emerald-600 px-7 py-4 text-base font-bold text-white transition hover:bg-emerald-500 disabled:opacity-50"
            >
              <CheckIcon className="size-5" />
              Mark as resolved
            </button>
          </>
        ) : (
          <>
            <p className="mt-5 text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
              Notified — tap to accept
            </p>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              {data.responders.map((responder) => (
                <button
                  key={responder.id}
                  type="button"
                  onClick={() => claim(responder.id)}
                  disabled={busy}
                  className="flex items-center gap-2 rounded-2xl bg-rose-600 px-5 py-3.5 text-sm font-bold text-white transition hover:bg-rose-500 disabled:opacity-50"
                >
                  <PhoneIcon className="size-4" />
                  {responder.name}
                  <span className="font-normal opacity-80">· {responder.role}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
