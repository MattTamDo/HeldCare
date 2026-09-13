"use client";

import { useCallback, useRef, useState } from "react";

import { useFallFeed } from "@/hooks/useFallFeed";
import { CAMERA_WALL } from "@/lib/fall/config";

import { CameraTile, type TileHandle } from "./CameraTile";
import { HandoffPanel } from "./HandoffPanel";
import { useManualFallKey } from "./useManualFallKey";

const LIVE_SOURCE_ID =
  CAMERA_WALL.find((source) => source.kind === "live")?.id ?? CAMERA_WALL[0].id;

export function CameraWall({ demoMode = false }: { demoMode?: boolean }) {
  const { reports, clear } = useFallFeed();
  const [selectedId, setSelectedId] = useState(LIVE_SOURCE_ID);

  const handles = useRef(new Map<string, TileHandle>());

  const register = useCallback((id: string, handle: TileHandle | null) => {
    if (handle) handles.current.set(id, handle);
    else handles.current.delete(id);
  }, []);

  const triggerSelected = useCallback(() => {
    handles.current.get(selectedId)?.triggerManualFall();
  }, [selectedId]);

  const resetAll = useCallback(() => {
    for (const handle of handles.current.values()) handle.resetDetector();
  }, []);

  useManualFallKey(triggerSelected);

  const selectedRoomId =
    CAMERA_WALL.find((source) => source.id === selectedId)?.roomId ?? null;

  return (
    <main className="mx-auto w-full max-w-[100rem] px-5 py-6">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <p className="text-xs font-semibold tracking-[0.2em] text-sky-400 uppercase">
            CareFall · Camera Wall
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">
            Fall detection monitoring
          </h1>
          <p className="text-sm text-slate-400">
            Oakwood Senior Living · Floor 2 · {CAMERA_WALL.length} windows
          </p>
        </div>
        <div className="flex items-center gap-3">
          {demoMode && (
            <span className="rounded-full border border-sky-500/40 bg-sky-500/10 px-3 py-1 text-xs font-semibold tracking-wide text-sky-300 uppercase">
              Demo mode
            </span>
          )}
        </div>
      </header>

      <div className="mt-5 grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="grid gap-4 sm:grid-cols-2">
          {CAMERA_WALL.map((source) => (
            <CameraTile
              key={source.id}
              source={source}
              showDiagnostics={false}
              selected={selectedId === source.id}
              onSelect={() => setSelectedId(source.id)}
              register={register}
            />
          ))}
        </div>

        <div className="xl:sticky xl:top-6 xl:max-h-[calc(100vh-3rem)]">
          <HandoffPanel
            reports={reports}
            selectedRoomId={selectedRoomId}
            onTrigger={triggerSelected}
            onResetAll={resetAll}
            onClearFeed={clear}
          />
        </div>
      </div>

      <p className="mt-6 text-[11px] leading-relaxed text-slate-500">
        Fall scores are a demonstration heuristic, not a medically validated
        measure. Click a window to choose which room the manual{" "}
        <span className="font-mono">F</span> trigger reports.
      </p>
    </main>
  );
}
