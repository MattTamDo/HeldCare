"use client";

export default function MicButton({
  listening,
  supported,
  onToggle,
}: {
  listening: boolean;
  supported: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={!supported}
      title={supported ? "Speak" : "Speech input not supported on this browser"}
      aria-label={listening ? "Stop listening" : "Speak"}
      className={`shrink-0 rounded-xl border px-4 py-3 text-sm font-semibold transition ${
        listening
          ? "border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200"
          : "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
      } disabled:opacity-40`}
    >
      {listening ? "◼" : "🎤"}
    </button>
  );
}
