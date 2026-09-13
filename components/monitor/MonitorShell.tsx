"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

import { FacilityBoard } from "@/components/dashboard/FacilityBoard";
import { ResponderAlerts } from "@/components/dashboard/ResponderAlerts";
import { useIncidentBoard } from "@/hooks/useIncidentBoard";
import { CAMERA_WALL } from "@/lib/fall/config";
import type { IncidentBoardData } from "@/lib/incidents/board";
import type { MonitorTab } from "@/lib/monitor/tabs";

import { AppHeader } from "./AppHeader";
import { CameraWall } from "./CameraWall";
import { MonitorTabNav } from "./MonitorTabNav";

export function MonitorShell({
  tab,
  initialBoard,
  demoMode = false,
}: {
  tab: MonitorTab;
  initialBoard: IncidentBoardData;
  demoMode?: boolean;
}) {
  const router = useRouter();
  const board = useIncidentBoard(initialBoard);
  const [query, setQuery] = useState("");

  const hrefFor = useCallback(
    (target: MonitorTab) => {
      const params = new URLSearchParams();
      if (target !== "cameras") params.set("tab", target);
      if (demoMode) params.set("demo", "true");
      const search = params.toString();
      return search ? `/monitor?${search}` : "/monitor";
    },
    [demoMode],
  );

  const openResponder = useCallback(() => {
    router.push(hrefFor("responder"), { scroll: false });
  }, [hrefFor, router]);

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader
        query={query}
        onQueryChange={setQuery}
        cameraCount={CAMERA_WALL.length}
        activeIncidentCount={board.board.activeIncidentCount}
      />

      <MonitorTabNav
        tab={tab}
        demoMode={demoMode}
        activeIncidentCount={board.board.activeIncidentCount}
        hrefFor={hrefFor}
      />

      {/* The wall stays mounted so cameras and pose runtimes survive tab switches. */}
      <div className={tab === "cameras" ? "flex-1" : "hidden"} hidden={tab !== "cameras"}>
        <CameraWall
          board={board}
          active={tab === "cameras"}
          demoMode={demoMode}
          query={query}
          onOpenResponder={openResponder}
        />
      </div>

      {tab === "facility" && (
        <FacilityBoard board={board} demoMode={demoMode} query={query} />
      )}
      {tab === "responder" && <ResponderAlerts board={board} />}
    </div>
  );
}
