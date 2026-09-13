"use client";

import { useState } from "react";

import { Panel } from "./ui";

export type LogEntry = {
  id: number;
  role: "responder" | "assistant";
  text: string;
};

export default function LivePanel({
  listening,
  supported,
  interim,
  error,
  note,
  thinking,
  log,
  onToggleMic,
  onSubmitText,
}: {
  listening: boolean;
  supported: boolean;
  interim: string;
  error?: string;
  note?: string;
  thinking: boolean;
  log: LogEntry[];
  onToggleMic: () => void;
  onSubmitText: (text: string) => void;
}) {
  const [draft, setDraft] = useState("");

  function submit() {
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    onSubmitText(text);
  }

  const status = thinking
    ? "Working…"
    : listening
      ? "Listening…"
      : supported
        ? "Tap the mic or type below."
        : "Speech unavailable — type below.";

  return (
    <Panel
      title="HeldCare Live"
      action={
        <span className="flex items-center gap-1.5 text-[10px] font-semibold tracking-wider text-slate-500">
          <span
            className={`h-2 w-2 rounded-full ${
              listening
                ? "animate-pulse bg-rose-400"
                : thinking
                  ? "animate-pulse bg-amber-400"
                  : "bg-slate-600"
            }`}
          />
          {status.toUpperCase()}
        </span>
      }
    >
      <div className="space-y-2">
        {log.length === 0 && !interim ? (
          <p className="text-xs text-slate-500">
            Say what you observe — for example, &ldquo;She&apos;s awake but says
            her left hip hurts.&rdquo;
          </p>
        ) : null}

        {log.slice(-4).map((entry) => (
          <p
            key={entry.id}
            className={`text-xs leading-relaxed ${
              entry.role === "responder"
                ? "text-slate-700 dark:text-slate-300"
                : "text-sky-700 dark:text-sky-300"
            }`}
          >
            <span className="font-semibold">
              {entry.role === "responder" ? "You: " : "Live: "}
            </span>
            {entry.text}
          </p>
        ))}

        {interim ? (
          <p className="text-xs italic text-slate-500">{interim}</p>
        ) : null}
      </div>

      <div className="mt-3 flex gap-2">
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") submit();
          }}
          placeholder="Type an observation…"
          className="min-w-0 flex-1 rounded-full border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none placeholder:text-slate-400 focus:border-sky-400 focus:bg-white focus:ring-2 focus:ring-sky-100 dark:border-slate-700 dark:bg-slate-800 dark:focus:border-sky-500 dark:focus:ring-sky-900/40"
        />
        <button
          type="button"
          onClick={submit}
          className="shrink-0 rounded-full bg-slate-900 px-3 py-2.5 text-xs font-semibold text-white dark:bg-white dark:text-slate-900"
        >
          SEND
        </button>
        <button
          type="button"
          onClick={onToggleMic}
          disabled={!supported}
          aria-label={listening ? "Stop listening" : "Start listening"}
          className={`shrink-0 rounded-xl border px-3 py-2.5 text-sm transition ${
            listening
              ? "border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200"
              : "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
          } disabled:opacity-40`}
        >
          {listening ? "◼" : "🎤"}
        </button>
      </div>

      {error ? (
        <p className="mt-2 text-[11px] text-amber-400/80">{error}</p>
      ) : null}
      {note ? <p className="mt-2 text-[11px] text-slate-500">{note}</p> : null}
    </Panel>
  );
}
