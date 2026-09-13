import type { FallMonitorState } from "@/hooks/useFallMonitor";
import { FALL_CONFIG } from "@/lib/fall/config";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-slate-400">{label}</span>
      <span className="font-mono text-slate-100">{value}</span>
    </div>
  );
}

function SignalBar({
  label,
  score,
  weight,
}: {
  label: string;
  score: number;
  weight: number;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between text-[11px]">
        <span className="text-slate-400">{label}</span>
        <span className="font-mono text-slate-300">
          {Math.round(score * 100)}% × {weight.toFixed(2)}
        </span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-800">
        <div
          className="h-full rounded-full bg-sky-400/80 transition-[width] duration-150"
          style={{ width: `${Math.round(score * 100)}%` }}
        />
      </div>
    </div>
  );
}

export function DebugHud({ state }: { state: FallMonitorState }) {
  const { features, scores } = state;
  const weights = FALL_CONFIG.confidence.weights;

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <header className="mb-3 flex items-center justify-between">
        <h2 className="text-xs font-semibold tracking-widest text-slate-400 uppercase">
          Developer diagnostics
        </h2>
        <span className="font-mono text-[11px] text-slate-500">
          {state.runtimeMode
            ? `${state.runtimeMode} · ${state.delegate}`
            : "not started"}
        </span>
      </header>

      <div className="space-y-1.5 text-sm">
        <Row label="State" value={state.fallState} />
        <Row
          label="Pose confidence"
          value={features ? features.poseConfidence.toFixed(2) : "—"}
        />
        <Row
          label="Torso angle"
          value={features ? `${features.torsoAngle.toFixed(0)}°` : "—"}
        />
        <Row
          label="Torso rate"
          value={features ? `${features.torsoAngleRate.toFixed(0)}°/s` : "—"}
        />
        <Row
          label="Hip velocity"
          value={features ? features.hipVelocity.toFixed(2) : "—"}
        />
        <Row
          label="Aspect ratio"
          value={features ? features.aspectRatio.toFixed(2) : "—"}
        />
        <Row
          label="Hip / shoulder / nose Y"
          value={
            features
              ? `${features.hipY.toFixed(2)} · ${features.shoulderY.toFixed(2)} · ${features.noseY.toFixed(2)}`
              : "—"
          }
        />
        <Row
          label="Vertical drop"
          value={features ? features.verticalDrop.toFixed(3) : "—"}
        />
        <Row label="Persistence" value={`${Math.round(state.persistenceMs)} ms`} />
        <Row
          label="Fall score"
          value={`${Math.round(state.confidence * 100)}%`}
        />
        <Row label="FPS" value={`${state.fps}`} />
        <Row label="Inference" value={`${state.inferenceMs.toFixed(1)} ms`} />
      </div>

      <div className="mt-4 space-y-2 border-t border-slate-800 pt-3">
        <SignalBar
          label="Rapid downward movement"
          score={scores.rapidDescent}
          weight={weights.rapidDescent}
        />
        <SignalBar
          label="Horizontal torso"
          score={scores.horizontalTorso}
          weight={weights.horizontalTorso}
        />
        <SignalBar
          label="Body aspect ratio"
          score={scores.aspectRatio}
          weight={weights.aspectRatio}
        />
        <SignalBar
          label="Low body position"
          score={scores.lowPosition}
          weight={weights.lowPosition}
        />
        <SignalBar
          label="Persistence"
          score={scores.persistence}
          weight={weights.persistence}
        />
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
        Trigger at {Math.round(FALL_CONFIG.confidence.triggerThreshold * 100)}%
        after {FALL_CONFIG.stateMachine.persistenceMs} ms of held fall posture.
        Demonstration heuristic only — not a medically validated score.
      </p>
    </section>
  );
}
