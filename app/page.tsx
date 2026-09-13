import Link from "next/link";

import { CAMERA_WALL, DEFAULT_ROOM_ID, getMonitoredRoom } from "@/lib/fall/config";

export default function Home() {
  const liveRoom = getMonitoredRoom(DEFAULT_ROOM_ID);
  const clipCount = CAMERA_WALL.filter(
    (source) => source.kind === "video",
  ).length;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-6 py-16">
      <p className="text-xs font-semibold tracking-[0.2em] text-sky-400 uppercase">
        HeldCare
      </p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">
        Fall detection module
      </h1>
      <p className="mt-3 text-slate-400">
        Camera monitoring and temporal fall detection for Oakwood Senior Living.
      </p>

      <div className="mt-8 space-y-3">
        <Link
          href="/monitor"
          className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/60 px-5 py-4 transition hover:border-sky-500/50 hover:bg-slate-900"
        >
          <span>
            <span className="block font-semibold">Camera wall</span>
            <span className="block text-sm text-slate-400">
              {clipCount} uploadable clips + live room camera
            </span>
          </span>
          <span className="text-sky-400">Open →</span>
        </Link>

        <Link
          href={`/camera/${liveRoom.roomId}`}
          className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/60 px-5 py-4 transition hover:border-sky-500/50 hover:bg-slate-900"
        >
          <span>
            <span className="block font-semibold">
              Room {liveRoom.roomId} · single camera
            </span>
            <span className="block text-sm text-slate-400">
              {liveRoom.residentName} · full diagnostics
            </span>
          </span>
          <span className="text-sky-400">Open →</span>
        </Link>
      </div>
    </main>
  );
}
