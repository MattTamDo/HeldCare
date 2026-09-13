import Link from "next/link";

import { CAMERA_WALL, DEFAULT_ROOM_ID, getMonitoredRoom } from "@/lib/fall/config";
import { FACILITY_NAME } from "@/lib/mock/data";

type Entry = {
  href: string;
  title: string;
  detail: string;
  module: string;
};

export default function Home() {
  const liveRoom = getMonitoredRoom(DEFAULT_ROOM_ID);
  const clipCount = CAMERA_WALL.filter((source) => source.kind === "video").length;

  const entries: Entry[] = [
    {
      href: "/monitor",
      title: "Camera wall",
      detail: `${clipCount} uploadable clips + live room camera`,
      module: "Fall detection",
    },
    {
      href: `/camera/${liveRoom.roomId}`,
      title: `Room ${liveRoom.roomId} · single camera`,
      detail: `${liveRoom.residentName} · full detector diagnostics`,
      module: "Fall detection",
    },
    {
      href: "/dashboard?demo=true",
      title: "Facility dashboard",
      detail: "Room status board, alerts in real time",
      module: "Incident response",
    },
    {
      href: "/responder",
      title: "Responder app",
      detail: "Claim an alert and mark it resolved",
      module: "Incident response",
    },
  ];

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-6 py-16">
      <p className="text-xs font-semibold tracking-[0.2em] text-sky-500 uppercase dark:text-sky-400">
        CareFall
      </p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">
        Emergency response demo
      </h1>
      <p className="mt-3 text-zinc-500">
        {FACILITY_NAME} — a camera detects a fall, the facility is alerted, and a
        responder is dispatched.
      </p>

      <div className="mt-8 space-y-3">
        {entries.map((entry) => (
          <Link
            key={entry.href}
            href={entry.href}
            className="flex items-center justify-between gap-4 rounded-xl border border-zinc-200 bg-white px-5 py-4 transition hover:border-sky-500/50 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/60 dark:hover:bg-zinc-900"
          >
            <span>
              <span className="block text-[10px] font-semibold tracking-[0.15em] text-zinc-400 uppercase">
                {entry.module}
              </span>
              <span className="mt-1 block font-semibold">{entry.title}</span>
              <span className="block text-sm text-zinc-500">{entry.detail}</span>
            </span>
            <span className="text-sky-500 dark:text-sky-400">Open →</span>
          </Link>
        ))}
      </div>

      <p className="mt-8 text-xs text-zinc-400">
        Post-fall assessment is owned by module 3 — see PLAN.md.
      </p>
    </main>
  );
}
