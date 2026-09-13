"use client";

import { useCallback, useState } from "react";

import { useRealtime } from "@/lib/hooks/useRealtime";
import type { IncidentBoardData } from "@/lib/incidents/board";

/**
 * Shared read of the incident module's board. The first value is rendered on
 * the server, so there is no loading flash and no fetch on mount — the client
 * only re-reads when an SSE event says something changed.
 */
export function useIncidentBoard(initial: IncidentBoardData) {
  const [board, setBoard] = useState(initial);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard");
      setBoard((await res.json()) as IncidentBoardData);
    } catch {
      // Offline or the route restarted; the next event retries.
    }
  }, []);

  useRealtime(() => {
    void refresh();
  });

  const activeRoom = board.rooms.find((room) => room.incident) ?? null;
  const activeIncident = activeRoom?.incident ?? null;

  const respond = useCallback(
    async (responderId: string) => {
      if (!activeIncident) return;
      await fetch(`/api/incidents/${activeIncident.id}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ responderId }),
      });
      void refresh();
    },
    [activeIncident, refresh],
  );

  const resolve = useCallback(async () => {
    if (!activeIncident) return;
    await fetch(`/api/incidents/${activeIncident.id}/resolve`, { method: "POST" });
    void refresh();
  }, [activeIncident, refresh]);

  return { board, activeIncident, activeRoom, respond, resolve, refresh };
}
