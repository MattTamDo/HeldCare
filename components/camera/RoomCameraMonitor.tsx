"use client";

import { useState } from "react";

import { useFallMonitor } from "@/hooks/useFallMonitor";
import type { MonitoredRoom } from "@/lib/fall/config";
import { FALL_CONFIG } from "@/lib/fall/config";

import { DebugHud } from "./DebugHud";
import { FallAlert } from "./FallAlert";
import { StatusPill } from "./StatusPill";

const BUTTON_BASE =
  "inline-flex w-full items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40";

export function RoomCameraMonitor({
  room,
  demoMode = false,
}: {
  room: MonitoredRoom;
  /** `?demo=true` — surfaces the manual trigger prominently for judges. */
  demoMode?: boolean;
}) {
  const {
    videoRef,
    canvasRef,
    state,
    reports,
    lastReport,
    eventCount,
    start,
    stop,
    resetDetector,
    triggerManualFall,
  } = useFallMonitor({ roomId: room.roomId, residentId: room.residentId });

  const [showDebug, setShowDebug] = useState(true);

  const cameraLive = state.status === "running" || state.status === "starting";
  const isFall = state.fallState === "CONFIRMED_FALL";
  const fallScore = Math.round(state.confidence * 100);

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-8">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <p className="text-xs font-semibold tracking-[0.2em] text-sky-400 uppercase">
            CareFall · Room Camera
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">
            Room {room.roomId}
          </h1>
          <p className="text-slate-400">
            {room.residentName} · Floor {room.floor}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {demoMode && (
            <span className="rounded-full border border-sky-500/40 bg-sky-500/10 px-3 py-1 text-xs font-semibold tracking-wide text-sky-300 uppercase">
              Demo mode
            </span>
          )}
          <StatusPill status={state.status} fallState={state.fallState} />
        </div>
      </header>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        {/* Camera stage ------------------------------------------------- */}
        <section>
          <div
            className={`relative overflow-hidden rounded-2xl border bg-black ${
              isFall ? "border-rose-500/70" : "border-slate-800"
            }`}
          >
            <div className="relative aspect-video w-full -scale-x-100">
              <video
                ref={videoRef}
                playsInline
                muted
                autoPlay
                className="absolute inset-0 size-full object-cover"
              />
              <canvas
                ref={canvasRef}
                className="absolute inset-0 size-full object-cover"
              />
            </div>

            {!cameraLive && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950/80 text-center">
                <p className="text-sm font-semibold text-slate-200">
                  Camera is off
                </p>
                <p className="max-w-xs text-xs text-slate-400">
                  Start the camera to begin pose monitoring for Room{" "}
                  {room.roomId}.
                </p>
              </div>
            )}

            {cameraLive && !state.modelReady && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950/70 text-center">
                <span className="size-6 animate-spin rounded-full border-2 border-slate-600 border-t-sky-400" />
                <p className="text-sm font-semibold text-slate-200">
                  Loading pose model
                </p>
                <p className="max-w-xs text-xs text-slate-400">
                  First run warms up the MediaPipe graph. Manual trigger (F)
                  already works.
                </p>
              </div>
            )}

            <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-4">
              <span className="rounded-md bg-slate-950/70 px-2.5 py-1 text-xs font-semibold tracking-wide text-slate-200 backdrop-blur">
                ROOM {room.roomId} · {room.residentName}
              </span>
              {state.status === "running" && (
                <span className="rounded-md bg-slate-950/70 px-2.5 py-1 font-mono text-xs text-slate-300 backdrop-blur">
                  {state.fps} fps
                </span>
              )}
            </div>

            {isFall && (
              <div className="absolute inset-x-0 bottom-0 p-4">
                <FallAlert confidence={state.confidence} report={lastReport} />
              </div>
            )}
          </div>

          {state.error && (
            <p className="mt-3 rounded-lg border border-rose-500/40 bg-rose-950/40 px-4 py-3 text-sm text-rose-200">
              {state.error}
            </p>
          )}

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <button
              type="button"
              onClick={cameraLive ? stop : () => void start()}
              className={`${BUTTON_BASE} ${
                cameraLive
                  ? "bg-slate-800 text-slate-100 hover:bg-slate-700"
                  : "bg-sky-500 text-slate-950 hover:bg-sky-400"
              }`}
            >
              {cameraLive ? "Stop camera" : "Start camera"}
            </button>
            <button
              type="button"
              onClick={triggerManualFall}
              className={`${BUTTON_BASE} border border-rose-500/50 bg-rose-500/10 text-rose-200 hover:bg-rose-500/20`}
            >
              Trigger fall (F)
            </button>
            <button
              type="button"
              onClick={resetDetector}
              className={`${BUTTON_BASE} border border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800`}
            >
              Reset detector
            </button>
          </div>
        </section>

        {/* Side panel --------------------------------------------------- */}
        <aside className="space-y-4">
          <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <h2 className="text-xs font-semibold tracking-widest text-slate-400 uppercase">
              Detector
            </h2>
            <p className="mt-2 font-mono text-lg font-semibold text-slate-100">
              {state.fallState}
            </p>
            <p className="text-sm text-slate-400">
              {state.poseDetected ? "Pose detected" : "No pose in frame"}
            </p>

            <div className="mt-4">
              <div className="flex items-baseline justify-between text-sm">
                <span className="text-slate-400">Fall score</span>
                <span className="font-mono font-semibold text-slate-100">
                  {fallScore}%
                </span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-800">
                <div
                  className={`h-full rounded-full transition-[width] duration-150 ${
                    fallScore >=
                    FALL_CONFIG.confidence.triggerThreshold * 100
                      ? "bg-rose-500"
                      : fallScore >= 40
                        ? "bg-amber-400"
                        : "bg-emerald-400"
                  }`}
                  style={{ width: `${fallScore}%` }}
                />
              </div>
            </div>

            {state.persistenceMs > 0 && (
              <p className="mt-3 font-mono text-xs text-amber-300">
                holding fall posture {Math.round(state.persistenceMs)} ms /{" "}
                {FALL_CONFIG.stateMachine.persistenceMs} ms
              </p>
            )}
          </section>

          <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold tracking-widest text-slate-400 uppercase">
                Emitted events
              </h2>
              <span className="font-mono text-sm text-slate-200">
                {eventCount}
              </span>
            </div>

            {reports.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">
                No fall events emitted yet.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {reports.slice(0, 4).map((report) => (
                  <li
                    key={`${report.event.timestamp}-${report.trigger}`}
                    className="rounded-lg border border-slate-800 bg-slate-950/60 p-2.5 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-rose-300">
                        FALL_DETECTED
                      </span>
                      <span className="text-slate-500">
                        {new Date(
                          report.event.timestamp,
                        ).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="mt-1 text-slate-400">
                      room {report.event.roomId} ·{" "}
                      {Math.round(report.event.confidence * 100)}% ·{" "}
                      {report.trigger}
                    </p>
                    <p className="mt-0.5 text-slate-500">
                      {report.outcome.delivered
                        ? "posted to incident API"
                        : `logged only — ${report.outcome.reason}`}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3">
            <span className="text-xs font-semibold tracking-widest text-slate-400 uppercase">
              Diagnostics
            </span>
            <button
              type="button"
              onClick={() => setShowDebug((visible) => !visible)}
              className="rounded-md border border-slate-700 px-2.5 py-1 text-xs font-semibold text-slate-300 hover:bg-slate-800"
            >
              {showDebug ? "Hide" : "Show"}
            </button>
          </div>

          {showDebug && <DebugHud state={state} />}
        </aside>
      </div>
    </main>
  );
}
