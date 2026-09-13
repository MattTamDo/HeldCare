"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { RoomCard, type RoomCardStatus } from "@/components/dashboard/RoomCard";
import { useRealtime } from "@/lib/hooks/useRealtime";
import type { MockResponder } from "@/lib/mock/data";
import type { RoomState } from "@/lib/types/incident";

type DashboardData = {
  facility: string;
  rooms: RoomState[];
  responders: MockResponder[];
  activeIncidentCount: number;
};

function playAlertTone() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.value = 0.15;
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.4);
    osc.onended = () => ctx.close();
  } catch {
    // autoplay blocked or AudioContext unavailable — non-critical
  }
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="p-8 text-zinc-500">Loading facility…</div>}>
      <DashboardContent />
    </Suspense>
  );
}

function DashboardContent() {
  const searchParams = useSearchParams();
  const demoMode = searchParams.get("demo") === "true";

  const [data, setData] = useState<DashboardData | null>(null);

  const fetchDashboard = useCallback(() => fetch("/api/dashboard").then((res) => res.json() as Promise<DashboardData>), []);

  useEffect(() => {
    fetchDashboard().then(setData);
  }, [fetchDashboard]);

  useRealtime((event) => {
    if (event.type === "incident_created") playAlertTone();
    fetchDashboard().then(setData);
  });

  async function simulateFall() {
    await fetch("/api/incidents/fall", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "FALL_DETECTED",
        roomId: "204",
        residentId: "margaret",
        timestamp: Date.now(),
        confidence: 0.91,
      }),
    });
  }

  async function resetDemo() {
    await fetch("/api/demo/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomId: "204" }),
    });
    fetchDashboard().then(setData);
  }

  if (!data) {
    return <div className="p-8 text-zinc-500">Loading facility…</div>;
  }

  return (
    <div className="flex min-h-full flex-col gap-6 bg-zinc-50 p-6 dark:bg-zinc-950">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">CareFall — Facility Command Center</h1>
        <p className="text-sm text-zinc-500">
          <span className="text-emerald-500">System Online ●</span> | {data.rooms.length} Rooms |{" "}
          {data.activeIncidentCount} Active Incidents
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {data.rooms.map((room) => (
          <RoomCard
            key={room.id}
            roomId={room.id}
            residentName={room.residentName}
            status={room.status as RoomCardStatus}
            responderName={room.incident?.responderName}
          />
        ))}
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-2 text-sm font-semibold text-zinc-500">Responder roster</h2>
        <ul className="flex flex-wrap gap-3 text-sm">
          {data.responders.map((r) => (
            <li key={r.id} className="rounded-full border border-zinc-200 px-3 py-1 dark:border-zinc-700">
              {r.name} <span className="text-zinc-400">· {r.role}</span>
            </li>
          ))}
        </ul>
      </div>

      {demoMode && (
        <div className="mt-auto flex gap-3 rounded-xl border border-dashed border-zinc-300 p-4 dark:border-zinc-700">
          <button
            onClick={simulateFall}
            className="rounded-lg bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-700"
          >
            SIMULATE FALL
          </button>
          <button
            onClick={resetDemo}
            className="rounded-lg bg-zinc-600 px-4 py-2 font-medium text-white hover:bg-zinc-700"
          >
            RESET DEMO
          </button>
        </div>
      )}
    </div>
  );
}
