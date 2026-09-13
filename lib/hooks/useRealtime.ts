"use client";

import { useEffect, useRef } from "react";
import type { RealtimeEvent } from "@/lib/types/incident";

/** Subscribes to the SSE incident stream and calls `onEvent` for every message. */
export function useRealtime(onEvent: (event: RealtimeEvent) => void) {
  const handlerRef = useRef(onEvent);

  useEffect(() => {
    handlerRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    const source = new EventSource("/api/realtime/stream");

    source.onmessage = (message) => {
      try {
        const event: RealtimeEvent = JSON.parse(message.data);
        handlerRef.current(event);
      } catch {
        // heartbeat / comment lines have no `data:` payload and never reach here
      }
    };

    return () => source.close();
  }, []);
}
