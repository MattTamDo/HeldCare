"use client";

import { useEffect, useRef, useState } from "react";

import type { Vitals } from "@/lib/assessment/types";
import {
  STAGE_LABELS,
  configuredVitalsMode,
  createVitalsProvider,
  type VitalsProvider,
  type VitalsSnapshot,
} from "@/lib/vitals";
import { Panel, Stat } from "./ui";

const ACTIVE_STAGES = new Set(["initializing", "searching", "acquired", "measuring"]);

export default function VitalsPanel({
  onVitals,
}: {
  onVitals: (vitals: Vitals) => void;
}) {
  const providerRef = useRef<VitalsProvider | null>(null);
  const [snapshot, setSnapshot] = useState<VitalsSnapshot>({
    stage: "idle",
    vitals: {},
  });
  const [mode, setMode] = useState<"mock" | "live">("mock");

  // Kept in a ref so the subscription never needs re-creating.
  const onVitalsRef = useRef(onVitals);
  onVitalsRef.current = onVitals;

  useEffect(() => {
    const provider = createVitalsProvider();
    providerRef.current = provider;
    setMode(provider.mode);

    const unsubscribe = provider.subscribe?.((next) => {
      setSnapshot(next);
      if (next.stage === "available" && next.vitals.pulse) {
        onVitalsRef.current(next.vitals);
      }
    });

    return () => {
      unsubscribe?.();
      void provider.stop();
      providerRef.current = null;
    };
  }, []);

  const running = ACTIVE_STAGES.has(snapshot.stage);
  const done = snapshot.stage === "available";

  async function handleStart() {
    try {
      await providerRef.current?.start();
    } catch {
      // The provider already emitted an error snapshot; nothing more to do.
    }
  }

  return (
    <Panel
      title="CONTACTLESS MEASUREMENT"
      action={
        <span className="rounded-full border border-edge px-2 py-0.5 text-[10px] font-semibold tracking-wider text-slate-500">
          {mode.toUpperCase()}
        </span>
      }
    >
      {done ? (
        <div className="grid grid-cols-3 gap-2">
          <Stat
            label="PULSE EST."
            value={snapshot.vitals.pulse ? `${snapshot.vitals.pulse}` : "—"}
          />
          <Stat
            label="BREATHING EST."
            value={
              snapshot.vitals.respiration ? `${snapshot.vitals.respiration}` : "—"
            }
          />
          <Stat label="SIGNAL" value={snapshot.vitals.signalQuality ?? "—"} />
        </div>
      ) : (
        <p className="mb-3 text-sm text-slate-400">
          {snapshot.stage === "error"
            ? (snapshot.error ?? STAGE_LABELS.error)
            : STAGE_LABELS[snapshot.stage]}
        </p>
      )}

      {done ? (
        <p className="mt-3 text-[11px] text-slate-500">
          Estimates from a signal measurement. Not a diagnosis.
        </p>
      ) : null}

      <button
        type="button"
        onClick={handleStart}
        disabled={running}
        className="mt-3 w-full rounded-xl border border-sky-400/40 bg-sky-500/15 px-4 py-3 text-sm font-semibold text-sky-100 transition hover:bg-sky-500/25 disabled:opacity-50"
      >
        {running
          ? "MEASURING…"
          : done
            ? "MEASURE AGAIN"
            : "START CONTACTLESS ASSESSMENT"}
      </button>

      {snapshot.stage === "error" && configuredVitalsMode() === "live" ? (
        <p className="mt-2 text-[11px] text-amber-400/80">
          Live provider failed. Set NEXT_PUBLIC_PRESAGE_MODE=mock for the demo.
        </p>
      ) : null}
    </Panel>
  );
}
