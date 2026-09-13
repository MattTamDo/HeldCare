import Link from "next/link";

import { DEFAULT_ROOM_ID, getMonitoredRoom } from "@/lib/fall/config";

export default function Home() {
  const room = getMonitoredRoom(DEFAULT_ROOM_ID);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-6 py-16">
      <p className="text-xs font-semibold tracking-[0.2em] text-sky-400 uppercase">
        CareFall
      </p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">
        Fall detection module
      </h1>
      <p className="mt-3 text-slate-400">
        Camera monitoring and temporal fall detection for Oakwood Senior Living.
        The dashboard and responder experience are owned by the other modules.
      </p>

      <Link
        href={`/camera/${room.roomId}`}
        className="mt-8 inline-flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/60 px-5 py-4 transition hover:border-sky-500/50 hover:bg-slate-900"
      >
        <span>
          <span className="block font-semibold">Room {room.roomId}</span>
          <span className="block text-sm text-slate-400">
            {room.residentName} · Floor {room.floor}
          </span>
        </span>
        <span className="text-sky-400">Open camera →</span>
      </Link>
    </main>
  );
}
