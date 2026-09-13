"use client";

import { useCallback, useEffect, useState } from "react";
import { useRealtime } from "@/lib/hooks/useRealtime";
import type { MockResponder } from "@/lib/mock/data";
import type { Incident } from "@/lib/types/incident";

type DashboardData = {
  rooms: { id: string; residentName?: string; incident?: Incident }[];
  responders: MockResponder[];
};

export default function ResponderPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [busy, setBusy] = useState(false);

  const fetchDashboard = useCallback(() => fetch("/api/dashboard").then((res) => res.json() as Promise<DashboardData>), []);

  useEffect(() => {
    fetchDashboard().then(setData);
  }, [fetchDashboard]);

  useRealtime(() => fetchDashboard().then(setData));

  const alertRoom = data?.rooms.find((room) => room.incident);
  const incident = alertRoom?.incident;

  async function respond(responderId: string) {
    if (!incident) return;
    setBusy(true);
    await fetch(`/api/incidents/${incident.id}/respond`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ responderId }),
    });
    setBusy(false);
    fetchDashboard().then(setData);
  }

  async function resolve() {
    if (!incident) return;
    setBusy(true);
    await fetch(`/api/incidents/${incident.id}/resolve`, { method: "POST" });
    setBusy(false);
    fetchDashboard().then(setData);
  }

  return (
    <div className="flex min-h-full flex-col gap-6 bg-zinc-50 p-6 dark:bg-zinc-950">
      <h1 className="text-xl font-bold">Responder Alerts</h1>

      {!incident && (
        <div className="flex flex-1 items-center justify-center text-zinc-400">No active alerts.</div>
      )}

      {incident && (
        <div
          className={`flex flex-col items-center gap-4 rounded-2xl border-2 p-8 text-center ${
            incident.status === "alert"
              ? "border-red-500 bg-red-50 dark:bg-red-950/30"
              : "border-amber-400 bg-amber-50 dark:bg-amber-950/30"
          }`}
        >
          <span className="text-3xl">🚨 FALL DETECTED</span>
          <span className="text-lg font-medium">
            Room {alertRoom?.id} — {alertRoom?.residentName}
          </span>

          {incident.status === "alert" && (
            <p className="text-sm text-zinc-500">Notified: {data?.responders.map((r) => r.name).join(", ")}</p>
          )}

          {incident.status === "responding" && (
            <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
              {incident.responderName} is responding
            </p>
          )}

          <div className="mt-2 flex flex-wrap justify-center gap-2">
            {incident.status === "alert" &&
              data?.responders.map((r) => (
                <button
                  key={r.id}
                  onClick={() => respond(r.id)}
                  disabled={busy}
                  className="rounded-xl bg-red-600 px-4 py-3 font-bold text-white hover:bg-red-700 disabled:opacity-50"
                >
                  RESPOND as {r.name}
                </button>
              ))}

            {incident.status === "responding" && (
              <button
                onClick={resolve}
                disabled={busy}
                className="rounded-xl bg-amber-600 px-6 py-3 font-bold text-white hover:bg-amber-700 disabled:opacity-50"
              >
                RESOLVE
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
