"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

import type { AssessmentIncident, AssessmentState } from "@/lib/assessment/types";
import { collectProblems } from "@/lib/assessment/state";
import type { AssessmentAction } from "@/lib/gemini/tools";
import { useFadingCaption, useListenerCaption } from "@/hooks/useFadingCaption";
import { useGeminiLive } from "@/hooks/useGeminiLive";

async function unlockPhoneMedia(): Promise<{
  media: MediaStream;
  audio: AudioContext;
}> {
  if (!window.isSecureContext) {
    throw new Error(
      "Safari blocked the camera. Open the https:// Cloudflare link, not localhost or an IP.",
    );
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("This browser cannot open the camera. Use Safari on iPhone.");
  }

  const audio = new AudioContext();
  if (audio.state === "suspended") await audio.resume();

  try {
    const media = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: { facingMode: "environment" },
    });
    return { media, audio };
  } catch {
    const media = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: true,
    });
    return { media, audio };
  }
}

export default function GeminiLiveCopilot({
  incident,
  state,
  onAction,
  onOpenProblems,
  onOpenReport,
  onEnded,
}: {
  incident: AssessmentIncident;
  state: AssessmentState;
  onAction: (action: AssessmentAction) => void | Promise<void>;
  onOpenProblems: () => void;
  onOpenReport: () => void;
  onEnded?: (session: { inputText: string; outputText: string }) => void;
}) {
  const live = useGeminiLive({ incident, state, onAction, onEnded });
  const previewRef = useRef<HTMLCanvasElement>(null);
  const [localError, setLocalError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const problems = collectProblems(state);
  const copilotLine = useFadingCaption(live.outputText, live.voicePlaying);
  const userLine = useListenerCaption(live.inputText, live.voicePlaying);
  const error = localError ?? live.error;

  useEffect(() => {
    const canvas = previewRef.current;
    const video = live.videoRef.current;
    if (!canvas || !video || !live.stream) return;
    let frame = 0;
    const draw = () => {
      if (video.readyState >= 2) {
        const ctx = canvas.getContext("2d");
        if (ctx) {
          const width = video.videoWidth || 640;
          const height = video.videoHeight || 360;
          if (canvas.width !== width || canvas.height !== height) {
            canvas.width = width;
            canvas.height = height;
          }
          ctx.drawImage(video, 0, 0, width, height);
        }
      }
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [live.stream, live.videoRef]);

  async function handleStart() {
    if (live.live) {
      live.stop();
      setBusy(false);
      return;
    }

    setLocalError(undefined);
    setBusy(true);
    try {
      const { media, audio } = await unlockPhoneMedia();
      await live.start(media, audio);
    } catch (err) {
      setLocalError(
        err instanceof Error
          ? err.message
          : "Could not open the camera. Allow Camera and Microphone, then tap Start again.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={onOpenProblems}
          className="min-h-16 rounded-2xl bg-white text-sm font-semibold text-slate-700 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-200 dark:ring-slate-800"
        >
          Notes{problems.length > 0 ? ` (${problems.length})` : ""}
        </button>
        <a
          href="#start"
          onClick={(event) => {
            event.preventDefault();
            void handleStart();
          }}
          className={`flex min-h-16 items-center justify-center rounded-2xl text-base font-bold ${
            live.live
              ? "bg-rose-600 text-white"
              : "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
          }`}
        >
          {busy ? "Wait…" : live.live ? "Stop" : "Start"}
        </a>
        <button
          type="button"
          onClick={onOpenReport}
          className="min-h-16 rounded-2xl bg-white text-sm font-semibold text-slate-700 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-200 dark:ring-slate-800"
        >
          Report
        </button>
      </div>

      {error ? (
        <p className="mt-3 rounded-2xl bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
          {error}
        </p>
      ) : (
        <p className="mt-3 text-sm text-slate-500">
          Tap Start, then Allow Camera and Microphone.
        </p>
      )}

      <div className="relative mt-3 aspect-[3/4] overflow-hidden rounded-2xl bg-slate-900">
        <canvas ref={previewRef} className="h-full w-full object-cover" />
        {!live.stream ? (
          <div className="absolute inset-0 grid place-items-center text-sm font-semibold text-white/50">
            Camera preview after Start
          </div>
        ) : null}
        <div className="absolute inset-x-0 top-0 flex justify-between p-3 text-xs font-semibold text-white">
          <span className="rounded-full bg-black/50 px-3 py-1">
            {live.live ? "Live" : "Standby"}
          </span>
          <span className="rounded-full bg-black/50 px-3 py-1">
            {live.speaking ? "Speaking" : live.live ? "Listening" : "Ready"}
          </span>
        </div>
        <div className="absolute inset-x-3 top-12 flex flex-wrap justify-end gap-2">
          {state.vitals?.pulse ? <Chip>Pulse {state.vitals.pulse}</Chip> : null}
          {state.vitals?.respiration ? (
            <Chip>Breath {state.vitals.respiration}</Chip>
          ) : null}
          {problems.length > 0 ? (
            <Chip tone="alert">
              {problems.length} finding{problems.length === 1 ? "" : "s"}
            </Chip>
          ) : null}
        </div>
        <div className="absolute inset-x-4 bottom-4 space-y-2">
          {userLine ? (
            <p className="text-sm font-medium text-white/75">You: {userLine}</p>
          ) : null}
          {copilotLine ? (
            <p className="text-xl font-semibold leading-snug text-white">
              {copilotLine}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Chip({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "alert";
}) {
  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-semibold ${
        tone === "alert" ? "bg-rose-500/80 text-white" : "bg-black/50 text-white"
      }`}
    >
      {children}
    </span>
  );
}
