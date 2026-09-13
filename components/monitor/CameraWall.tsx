"use client";

import { useCallback, useMemo, useRef, useState } from "react";

import { DebugHud } from "@/components/camera/DebugHud";
import { AiAnalysisCard, VitalSignsCard } from "@/components/monitor/AnalysisPanels";
import { AlertRail } from "@/components/monitor/AlertRail";
import { useFallFeed } from "@/hooks/useFallFeed";
import { useSourceSnapshot } from "@/hooks/useFallSource";
import type { useIncidentBoard } from "@/hooks/useIncidentBoard";
import { CAMERA_WALL, getMonitoredRoom } from "@/lib/fall/config";

import { CameraTile, type TileHandle } from "./CameraTile";
import { useManualFallKey } from "./useManualFallKey";

const LIVE_SOURCE_ID =
  CAMERA_WALL.find((source) => source.kind === "live")?.id ?? CAMERA_WALL[0].id;

/** Spotlight cell: three of the four columns and all three rows. */
const SPOTLIGHT_CELL =
  "col-span-2 sm:col-span-2 lg:col-span-3 lg:row-span-3 lg:col-start-1 lg:row-start-1";

export function CameraWall({
  board,
  active = true,
  demoMode = false,
  query,
  onOpenResponder,
}: {
  board: ReturnType<typeof useIncidentBoard>;
  active?: boolean;
  demoMode?: boolean;
  query: string;
  onOpenResponder: () => void;
}) {
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

  useManualFallKey(triggerSelected, active);

  const selectedSource =
    CAMERA_WALL.find((source) => source.id === selectedId) ?? CAMERA_WALL[0];
  const selectedRoom = getMonitoredRoom(selectedSource.roomId);
  const selectedState = useSourceSnapshot(selectedId);

  // Searching highlights matching windows rather than hiding them, so a camera
  // is never silently dropped from the wall.
  const needle = query.trim().toLowerCase();
  const matches = useMemo(() => {
    if (!needle) return null;
    return new Set(
      CAMERA_WALL.filter((source) => {
        const room = getMonitoredRoom(source.roomId);
        return (
          room.roomId.toLowerCase().includes(needle) ||
          room.residentName.toLowerCase().includes(needle)
        );
      }).map((source) => source.id),
    );
  }, [needle]);

  return (
    <div className="mx-auto w-full max-w-[100rem] px-5 py-5">
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_21rem]">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:grid-rows-3">
            {CAMERA_WALL.map((source) => {
              const isSpotlight = source.id === selectedId;
              const dimmed = matches !== null && !matches.has(source.id);
              return (
                <CameraTile
                  key={source.id}
                  source={source}
                  spotlight={isSpotlight}
                  selected={isSpotlight}
                  onSelect={() => setSelectedId(source.id)}
                  register={register}
                  onCallForHelp={onOpenResponder}
                  className={`${isSpotlight ? SPOTLIGHT_CELL : ""} ${
                    dimmed ? "opacity-40" : ""
                  }`}
                />
              );
            })}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <AiAnalysisCard state={selectedState} />
            <VitalSignsCard state={selectedState} />
          </div>

          {demoMode && <DebugHud state={selectedState} />}

          <p className="text-[11px] leading-relaxed text-slate-400 dark:text-slate-500">
            Fall scores are a demonstration heuristic, not a medically validated
            measure. Click any window to make it the main view — the{" "}
            <span className="font-mono">F</span> key reports a fall for whichever
            room is showing.
          </p>
        </div>

        <AlertRail
          board={board.board}
          activeIncident={board.activeIncident}
          activeRoom={board.activeRoom}
          updatedAt={board.board.generatedAt}
          onRespond={board.respond}
          onResolve={board.resolve}
          selectedRoom={selectedRoom}
          reports={reports}
          cameraCount={CAMERA_WALL.length}
          onTrigger={triggerSelected}
          onResetAll={resetAll}
          onClearFeed={clear}
          showDemoControls={demoMode}
        />
      </div>
    </div>
  );
}
