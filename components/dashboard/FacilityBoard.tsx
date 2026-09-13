"use client";

import { RoomCard, type RoomCardStatus } from "@/components/dashboard/RoomCard";
import { Card } from "@/components/ui/Card";
import { UsersIcon } from "@/components/ui/icons";
import type { useIncidentBoard } from "@/hooks/useIncidentBoard";
import { ROOM_IDS } from "@/lib/mock/data";

export function FacilityBoard({
  board,
  demoMode = false,
  query,
}: {
  board: ReturnType<typeof useIncidentBoard>;
  demoMode?: boolean;
  query: string;
}) {
  const data = board.board;

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
    await Promise.all(
      ROOM_IDS.map((roomId) =>
        fetch("/api/demo/reset", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roomId }),
        }),
      ),
    );
    void board.refresh();
  }

  const needle = query.trim().toLowerCase();
  const rooms = needle
    ? data.rooms.filter(
        (room) =>
          room.id.toLowerCase().includes(needle) ||
          (room.residentName ?? "").toLowerCase().includes(needle),
      )
    : data.rooms;

  return (
    <div className="mx-auto w-full max-w-[100rem] space-y-4 px-5 py-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <Card bodyClassName="p-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">Rooms monitored</p>
          <p className="mt-0.5 text-2xl font-bold">{data.rooms.length}</p>
        </Card>
        <Card bodyClassName="p-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">Active alerts</p>
          <p
            className={`mt-0.5 text-2xl font-bold ${
              data.activeIncidentCount > 0 ? "text-rose-600 dark:text-rose-400" : ""
            }`}
          >
            {data.activeIncidentCount}
          </p>
        </Card>
        <Card bodyClassName="p-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">Responders on shift</p>
          <p className="mt-0.5 text-2xl font-bold">{data.responders.length}</p>
        </Card>
      </div>

      {rooms.length === 0 ? (
        <Card bodyClassName="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
          No rooms match “{query}”.
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rooms.map((room) => (
            <RoomCard
              key={room.id}
              roomId={room.id}
              residentName={room.residentName}
              status={room.status as RoomCardStatus}
              responderName={room.incident?.responderName}
            />
          ))}
        </div>
      )}

      <Card
        title="Responder roster"
        icon={<UsersIcon className="size-4 text-sky-500" />}
        bodyClassName="px-4 pb-4"
      >
        <ul className="flex flex-wrap gap-2 text-sm">
          {data.responders.map((responder) => (
            <li
              key={responder.id}
              className="flex items-center gap-2 rounded-full bg-slate-50 py-1 pr-3 pl-1 ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700"
            >
              <span className="grid size-7 place-items-center rounded-full bg-white text-[10px] font-bold text-slate-500 dark:bg-slate-700 dark:text-slate-200">
                {responder.name
                  .split(" ")
                  .map((part) => part[0])
                  .join("")}
              </span>
              {responder.name}
              <span className="text-slate-400">· {responder.role}</span>
            </li>
          ))}
        </ul>
      </Card>

      {demoMode && (
        <Card title="Demo controls" bodyClassName="flex flex-wrap gap-2 px-4 pb-4">
          <button
            type="button"
            onClick={simulateFall}
            className="rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-500"
          >
            Simulate fall in 204
          </button>
          <button
            type="button"
            onClick={resetDemo}
            className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            Clear all alerts
          </button>
        </Card>
      )}
    </div>
  );
}
