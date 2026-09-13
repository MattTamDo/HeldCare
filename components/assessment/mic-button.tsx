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
          ? "border-rose-400 bg-rose-500/20 text-rose-200"
          : "border-edge bg-panel-2 text-slate-300 hover:border-slate-500"
      } disabled:opacity-40`}
    >
      {listening ? "◼" : "🎤"}
    </button>
  );
}
