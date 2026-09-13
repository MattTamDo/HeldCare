"use client";

import { useEffect, useRef, useState } from "react";

import { useFallSource } from "@/hooks/useFallSource";
import { FALL_CONFIG, type CameraSourceConfig } from "@/lib/fall/config";

import { DebugHud } from "../camera/DebugHud";
import { StatusPill } from "../camera/StatusPill";

export type TileHandle = {
  triggerManualFall: () => void;
  resetDetector: () => void;
};

const CONTROL =
  "rounded-md border px-2.5 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-40";

export function CameraTile({
  source,
  showDiagnostics,
  selected,
  onSelect,
  register,
  /** Single-room view: show the full HUD instead of the compact strip. */
  detailed = false,
}: {
  source: CameraSourceConfig;
  showDiagnostics: boolean;
  selected: boolean;
  onSelect: () => void;
  register: (id: string, handle: TileHandle | null) => void;
  detailed?: boolean;
}) {
  const {
    room,
    videoRef,
    canvasRef,
    state,
    videoSrc,
    clip,
    clipUnavailable,
    start,
    stop,
    replay,
    loadFile,
    resetDetector,
    triggerManualFall,
    handleTimelineJump,
    handleClipError,
  } = useFallSource(source);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    register(source.id, { triggerManualFall, resetDetector });
    return () => register(source.id, null);
  }, [register, resetDetector, source.id, triggerManualFall]);

  const isLive = source.kind === "live";
  const started = state.status === "running" || state.status === "starting";
  const isFall = state.fallState === "CONFIRMED_FALL";
  const fallScore = Math.round(state.confidence * 100);
  const needsClip = !isLive && (!videoSrc || clipUnavailable);

  const toggleClipPlayback = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) void video.play();
    else video.pause();
  };

  return (
    <article
      onClick={onSelect}
      className={`overflow-hidden rounded-xl border bg-slate-900/60 transition ${
        isFall
          ? "border-rose-500/70"
          : selected
            ? "border-sky-500/60"
            : "border-slate-800"
      }`}
    >
      <header className="flex items-center justify-between gap-2 px-3 py-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">
            Room {room.roomId}
            <span className="ml-2 text-xs font-normal text-slate-400">
              {room.residentName}
            </span>
          </p>
          <p className="truncate text-[11px] text-slate-500">
            {isLive ? "Live room camera" : (clip?.name ?? "No clip loaded")}
          </p>
        </div>
        <StatusPill status={state.status} fallState={state.fallState} />
      </header>

      <div className="relative bg-black">
        <div
          className={`relative aspect-video w-full ${isLive ? "-scale-x-100" : ""}`}
        >
          <video
            ref={videoRef}
            src={videoSrc ?? undefined}
            playsInline
            muted
            preload="auto"
            className="absolute inset-0 size-full object-contain"
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onEnded={() => setPlaying(false)}
            onSeeking={handleTimelineJump}
            onError={isLive ? undefined : handleClipError}
          />
          <canvas
            ref={canvasRef}
            className="absolute inset-0 size-full object-contain"
          />
        </div>

        {!started && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-950/80 px-4 text-center">
            <p className="text-xs font-semibold text-slate-200">
              {isLive
                ? "Camera is off"
                : needsClip
                  ? "No clip loaded"
                  : "Clip ready"}
            </p>
            <p className="text-[11px] text-slate-400">
              {isLive
                ? "Start the camera to monitor this room."
                : needsClip
                  ? "Upload a video to analyse it for falls."
                  : "Analyse the clip to run fall detection."}
            </p>
          </div>
        )}

        {started && !state.modelReady && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-950/70 text-center">
            <span className="size-5 animate-spin rounded-full border-2 border-slate-600 border-t-sky-400" />
            <p className="text-[11px] text-slate-300">Loading pose model</p>
          </div>
        )}

        {isFall && (
          <div className="animate-alert-pulse absolute inset-x-2 bottom-2 rounded-lg border border-rose-500/60 bg-rose-950/85 px-3 py-2 backdrop-blur">
            <p className="text-sm font-bold text-rose-100">🔴 FALL DETECTED</p>
            <p className="text-[11px] text-rose-200/80">
              Confidence: {fallScore}% · reported to incident workflow
            </p>
          </div>
        )}

        {state.status === "running" && !isFall && (
          <span className="absolute top-2 right-2 rounded bg-slate-950/70 px-1.5 py-0.5 font-mono text-[10px] text-slate-300">
            {state.fps} fps
          </span>
        )}
      </div>

      <div className="px-3 pt-2">
        <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
          <div
            className={`h-full rounded-full transition-[width] duration-150 ${
              fallScore >= FALL_CONFIG.confidence.triggerThreshold * 100
                ? "bg-rose-500"
                : fallScore >= 40
                  ? "bg-amber-400"
                  : "bg-emerald-400"
            }`}
            style={{ width: `${fallScore}%` }}
          />
        </div>
        <p className="mt-1 text-[11px] text-slate-500">
          Fall score {fallScore}% ·{" "}
          {state.poseDetected ? "pose detected" : "no pose"}
        </p>
      </div>

      {state.error && (
        <p className="mx-3 mt-2 rounded border border-rose-500/40 bg-rose-950/40 px-2 py-1.5 text-[11px] text-rose-200">
          {state.error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2 px-3 py-3">
        {isLive ? (
          <button
            type="button"
            onClick={started ? stop : () => void start()}
            className={`${CONTROL} ${
              started
                ? "border-slate-700 bg-slate-800 text-slate-100 hover:bg-slate-700"
                : "border-sky-500 bg-sky-500 text-slate-950 hover:bg-sky-400"
            }`}
          >
            {started ? "Stop camera" : "Start camera"}
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={started ? toggleClipPlayback : () => void start()}
              disabled={needsClip}
              className={`${CONTROL} ${
                started
                  ? "border-slate-700 bg-slate-800 text-slate-100 hover:bg-slate-700"
                  : "border-sky-500 bg-sky-500 text-slate-950 hover:bg-sky-400"
              }`}
            >
              {!started ? "Analyse clip" : playing ? "Pause" : "Resume"}
            </button>
            <button
              type="button"
              onClick={replay}
              disabled={needsClip || !started}
              className={`${CONTROL} border-slate-700 text-slate-300 hover:bg-slate-800`}
            >
              Replay
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className={`${CONTROL} border-slate-700 text-slate-300 hover:bg-slate-800`}
            >
              {clip ? "Change clip" : "Upload clip"}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) loadFile(file);
                event.target.value = "";
              }}
            />
          </>
        )}
      </div>

      {detailed && showDiagnostics && (
        <div className="border-t border-slate-800 p-3">
          <DebugHud state={state} />
        </div>
      )}
    </article>
  );
}
