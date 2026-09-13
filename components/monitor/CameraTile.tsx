"use client";

import { useEffect, useRef, useState } from "react";

import { useFallSource } from "@/hooks/useFallSource";
import { FALL_CONFIG, type CameraSourceConfig } from "@/lib/fall/config";
import { AlertIcon, CameraIcon, ExpandIcon } from "@/components/ui/icons";

import { describeMonitorState } from "../camera/StatusPill";

export type TileHandle = {
  triggerManualFall: () => void;
  resetDetector: () => void;
};

const BUTTON =
  "rounded-full px-3.5 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-40";

const GLASS_BUTTON =
  "grid size-9 place-items-center rounded-full bg-black/45 text-white backdrop-blur transition hover:bg-black/65 disabled:opacity-40";

const DOT_TONE = {
  idle: "bg-slate-400",
  good: "bg-emerald-400",
  warn: "bg-amber-400",
  alert: "bg-rose-500",
} as const;

function scoreColor(score: number) {
  if (score >= FALL_CONFIG.confidence.triggerThreshold * 100) return "bg-rose-500";
  if (score >= 40) return "bg-amber-400";
  return "bg-emerald-500";
}

/**
 * One camera window. `spotlight` and `thumb` render the same element tree and
 * differ only in styling, so promoting a window to the spotlight never
 * recreates its `<video>` node and never drops a running camera stream.
 */
export function CameraTile({
  source,
  spotlight,
  selected,
  onSelect,
  register,
  onCallForHelp,
  className = "",
}: {
  source: CameraSourceConfig;
  spotlight: boolean;
  selected: boolean;
  onSelect: () => void;
  register: (id: string, handle: TileHandle | null) => void;
  onCallForHelp?: () => void;
  className?: string;
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
  const frameRef = useRef<HTMLDivElement | null>(null);
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
  const { label: statusLabel, tone } = describeMonitorState(
    state.status,
    state.fallState,
  );

  const toggleClipPlayback = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) void video.play();
    else video.pause();
  };

  /** Saves the current frame with the skeleton overlay burned in. */
  const saveSnapshot = () => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return;

    const shot = document.createElement("canvas");
    shot.width = video.videoWidth;
    shot.height = video.videoHeight;
    const context = shot.getContext("2d");
    if (!context) return;

    context.drawImage(video, 0, 0, shot.width, shot.height);
    if (canvasRef.current) {
      context.drawImage(canvasRef.current, 0, 0, shot.width, shot.height);
    }

    const link = document.createElement("a");
    link.href = shot.toDataURL("image/png");
    link.download = `room-${room.roomId}-${Date.now()}.png`;
    link.click();
  };

  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void frameRef.current?.requestFullscreen?.();
  };

  const openClipPicker = () => fileInputRef.current?.click();

  const takeClipFile = (file?: File) => {
    if (file?.type.startsWith("video/")) loadFile(file);
  };

  const hide = (visible: boolean) => (visible ? "" : "hidden");

  return (
    <section
      onDragOver={(event) => {
        if (isLive) return;
        event.preventDefault();
      }}
      onDrop={(event) => {
        if (isLive) return;
        event.preventDefault();
        event.stopPropagation();
        takeClipFile(event.dataTransfer.files[0]);
      }}
      className={`relative flex flex-col overflow-hidden bg-slate-900 transition ${
        spotlight
          ? `rounded-2xl shadow-sm ring-1 ${isFall ? "ring-2 ring-rose-500" : "ring-slate-200 dark:ring-slate-800"}`
          : `rounded-xl ring-2 ${
              isFall
                ? "ring-rose-500"
                : selected
                  ? "ring-sky-500"
                  : "ring-transparent hover:ring-slate-300 dark:hover:ring-slate-700"
            }`
      } ${className}`}
    >
      {!isLive ? (
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*"
          className="sr-only"
          onChange={(event) => {
            takeClipFile(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
      ) : null}
      {/* Spotlight header */}
      <div
        className={`flex items-center justify-between gap-3 px-4 py-3 ${hide(spotlight)}`}
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="grid size-7 shrink-0 place-items-center rounded-full bg-white/10 text-white/80">
            <CameraIcon className="size-4" />
          </span>
          <p className="truncate text-sm font-semibold text-white">
            Room {room.roomId}
            <span className="ml-2 font-normal text-white/55">
              {room.residentName}
            </span>
          </p>
        </div>
        <span className="flex shrink-0 items-center gap-1.5 text-xs font-semibold text-white/80">
          <span
            className={`size-2 rounded-full ${DOT_TONE[tone]} ${
              tone === "good" || tone === "alert" ? "animate-dot-pulse" : ""
            }`}
          />
          {started ? (isLive ? "Live" : "Analysing") : statusLabel}
        </span>
      </div>

      <div className="relative flex-1">
        {/* Always the first child so the video node is never recreated. */}
        <div ref={frameRef} className="relative aspect-video w-full bg-slate-900">
          <div className={`absolute inset-0 ${isLive ? "-scale-x-100" : ""}`}>
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
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 px-3 text-center">
              <span
                className={`grid size-10 place-items-center rounded-full bg-white/10 text-white/70 ${hide(spotlight)}`}
              >
                <CameraIcon className="size-5" />
              </span>
              <p
                className={`font-semibold text-white ${spotlight ? "text-xs" : "text-[10px]"}`}
              >
                {isLive ? "Camera is off" : needsClip ? "No clip loaded" : "Clip ready"}
              </p>
              <p className={`text-[11px] text-white/60 ${hide(spotlight)}`}>
                {isLive
                  ? "Start the camera to monitor this room."
                  : needsClip
                    ? "Upload an MP4, or drop a file on this window."
                    : "Analyse the clip to run fall detection."}
              </p>
              {!isLive && needsClip ? (
                <button
                  type="button"
                  onClick={openClipPicker}
                  className={`mt-2 rounded-full bg-sky-600 px-4 py-2 font-semibold text-white ${
                    spotlight ? "text-sm" : "text-[10px]"
                  }`}
                >
                  Upload demo video
                </button>
              ) : null}
            </div>
          )}

          {started && !state.modelReady && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
              <span className="size-5 animate-spin rounded-full border-2 border-white/25 border-t-sky-400" />
              <p className={`text-[11px] text-white/70 ${hide(spotlight)}`}>
                Loading pose model
              </p>
            </div>
          )}
        </div>

        {/* Spotlight source chip */}
        <span
          className={`absolute top-3 left-3 rounded-md bg-black/55 px-2 py-1 font-mono text-[11px] text-white/85 backdrop-blur ${hide(
            spotlight && started,
          )}`}
        >
          Room {room.roomId} · {isLive ? "Live camera" : (clip?.name ?? "clip")}
        </span>

        {/* Spotlight glass controls */}
        <div className={`absolute top-3 right-3 flex-col gap-2 ${spotlight ? "flex" : "hidden"}`}>
          <button
            type="button"
            onClick={saveSnapshot}
            disabled={!started}
            title="Save snapshot"
            aria-label="Save snapshot"
            className={GLASS_BUTTON}
          >
            <CameraIcon className="size-4" />
          </button>
          <button
            type="button"
            onClick={toggleFullscreen}
            title="Fullscreen"
            aria-label="Fullscreen"
            className={GLASS_BUTTON}
          >
            <ExpandIcon className="size-4" />
          </button>
        </div>

        {/* Thumb status dot */}
        <span
          className={`absolute top-1.5 right-1.5 items-center gap-1 rounded-full bg-black/55 px-1.5 py-0.5 backdrop-blur ${
            spotlight ? "hidden" : "flex"
          }`}
        >
          <span
            className={`size-1.5 rounded-full ${DOT_TONE[tone]} ${
              tone === "alert" ? "animate-dot-pulse" : ""
            }`}
          />
          <span
            className={`text-[9px] font-bold tracking-wide text-rose-200 uppercase ${hide(isFall)}`}
          >
            Fall
          </span>
        </span>

        {/* Thumb caption */}
        <span
          className={`absolute inset-x-0 bottom-0 items-center justify-between gap-2 bg-gradient-to-t from-black/85 to-transparent px-2 pt-5 pb-1.5 ${
            spotlight ? "hidden" : "flex"
          }`}
        >
          <span className="truncate text-[11px] font-semibold text-white">
            Room {room.roomId}
          </span>
          <span
            className={`shrink-0 text-[9px] font-bold tracking-wide text-sky-300 uppercase ${hide(
              selected,
            )}`}
          >
            Viewing
          </span>
        </span>

        <span
          className={`absolute right-3 bottom-3 rounded-md bg-black/45 px-1.5 py-0.5 font-mono text-[10px] text-white/70 ${hide(
            spotlight && state.status === "running" && !isFall,
          )}`}
        >
          {state.fps} fps
        </span>

        {/* Spotlight fall banner */}
        <div
          className={`absolute inset-x-0 bottom-0 flex-wrap items-center justify-between gap-3 bg-gradient-to-t from-black/90 via-black/75 to-transparent px-4 pt-8 pb-4 ${
            spotlight && isFall ? "flex" : "hidden"
          }`}
        >
          <div className="flex items-center gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-rose-500/20 text-rose-300">
              <AlertIcon className="size-5" />
            </span>
            <span>
              <span className="block text-sm font-bold text-white">
                Fall detected
                <span className="ml-2 font-mono text-xs font-normal text-white/60">
                  {fallScore}% confidence
                </span>
              </span>
              <span className="block text-[11px] text-white/70">
                Resident appears to have fallen. Care team has been alerted.
              </span>
            </span>
          </div>
          <button
            type="button"
            onClick={onCallForHelp}
            className={`animate-alert-pulse rounded-full bg-rose-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-rose-500 ${hide(
              Boolean(onCallForHelp),
            )}`}
          >
            Call for help
          </button>
        </div>

        {/* Selection hit area stays under the upload chip so the file picker works. */}
        <button
          type="button"
          onClick={onSelect}
          aria-label={`View Room ${room.roomId} — ${room.residentName}`}
          className={`absolute inset-0 ${spotlight ? "hidden" : "block"}`}
        />
        {!isLive && !spotlight ? (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              openClipPicker();
            }}
            className="absolute bottom-8 left-2 z-10 rounded-full bg-sky-600 px-2.5 py-1 text-[10px] font-bold text-white"
          >
            {needsClip ? "Upload" : "Change"}
          </button>
        ) : null}
      </div>

      {/* Spotlight footer */}
      <div className={`bg-white px-4 py-3 dark:bg-slate-900 ${hide(spotlight)}`}>
        <div className="h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
          <div
            className={`h-full rounded-full transition-[width] duration-150 ${scoreColor(fallScore)}`}
            style={{ width: `${fallScore}%` }}
          />
        </div>
        <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
          Fall score {fallScore}% ·{" "}
          {state.poseDetected ? "pose detected" : "no pose in view"}
        </p>

        {state.error && (
          <p className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-[11px] text-rose-700 ring-1 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/30">
            {state.error}
          </p>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {isLive ? (
            <button
              type="button"
              onClick={started ? stop : () => void start()}
              className={`${BUTTON} ${
                started
                  ? "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                  : "bg-sky-600 text-white hover:bg-sky-500"
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
                className={`${BUTTON} ${
                  started
                    ? "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                    : "bg-sky-600 text-white hover:bg-sky-500"
                }`}
              >
                {!started ? "Analyse clip" : playing ? "Pause" : "Resume"}
              </button>
              <button
                type="button"
                onClick={replay}
                disabled={needsClip || !started}
                className={`${BUTTON} bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700`}
              >
                Replay
              </button>
              <button
                type="button"
                onClick={openClipPicker}
                className={`${BUTTON} bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700`}
              >
                {clip ? "Change clip" : "Upload clip"}
              </button>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
