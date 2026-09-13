"use client";

import Link from "next/link";
import { useCallback, useMemo, useRef, useState } from "react";

import { useFallFeed } from "@/hooks/useFallFeed";
import { getMonitoredRoom, type CameraSourceConfig } from "@/lib/fall/config";

import { CameraTile, type TileHandle } from "./CameraTile";
import { HandoffPanel } from "./HandoffPanel";
import { useManualFallKey } from "./useManualFallKey";

/** Focused single-room view, e.g. `/camera/204`. */
export function SingleRoomMonitor({
  roomId,
  demoMode = false,
}: {
  roomId: string;
  demoMode?: boolean;
}) {
  const room = getMonitoredRoom(roomId);
  const { reports, clear } = useFallFeed();
  const [showDiagnostics, setShowDiagnostics] = useState(true);

  const source = useMemo<CameraSourceConfig>(
    () => ({ id: `room-${roomId}`, kind: "live", roomId }),
    [roomId],
  );

  const handleRef = useRef<TileHandle | null>(null);
  const register = useCallback((_id: string, handle: TileHandle | null) => {
    handleRef.current = handle;
  }, []);

  const trigger = useCallback(() => {
    handleRef.current?.triggerManualFall();
  }, []);
  const resetAll = useCallback(() => {
    handleRef.current?.resetDetector();
  }, []);

  useManualFallKey(trigger);

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-6">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <p className="text-xs font-semibold tracking-[0.2em] text-sky-400 uppercase">
            CareFall · Room Camera
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">
            Room {room.roomId}
          </h1>
          <p className="text-sm text-slate-400">
            {room.residentName} · Floor {room.floor}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {demoMode && (
            <span className="rounded-full border border-sky-500/40 bg-sky-500/10 px-3 py-1 text-xs font-semibold tracking-wide text-sky-300 uppercase">
              Demo mode
            </span>
          )}
          <button
            type="button"
            onClick={() => setShowDiagnostics((visible) => !visible)}
            className="rounded-md border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:bg-slate-800"
          >
            {showDiagnostics ? "Hide diagnostics" : "Show diagnostics"}
          </button>
          <Link
            href="/monitor"
            className="rounded-md border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:bg-slate-800"
          >
            Camera wall →
          </Link>
        </div>
      </header>

      <div className="mt-5 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <CameraTile
          source={source}
          showDiagnostics={showDiagnostics}
          selected
          onSelect={() => {}}
          register={register}
          detailed
        />
        <div className="lg:sticky lg:top-6">
          <HandoffPanel
            reports={reports}
            selectedRoomId={room.roomId}
            onTrigger={trigger}
            onResetAll={resetAll}
            onClearFeed={clear}
          />
        </div>
      </div>
    </main>
  );
}
