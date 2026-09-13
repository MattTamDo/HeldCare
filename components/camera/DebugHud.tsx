import type { FallSourceState } from "@/hooks/useFallSource";
import { Card } from "@/components/ui/Card";
import { FALL_CONFIG } from "@/lib/fall/config";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-slate-500 dark:text-slate-400">{label}</span>
      <span className="font-mono">{value}</span>
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
        <span className="text-slate-500 dark:text-slate-400">{label}</span>
        <span className="font-mono text-slate-600 dark:text-slate-300">
          {Math.round(score * 100)}% × {weight.toFixed(2)}
        </span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
        <div
          className="h-full rounded-full bg-sky-500 transition-[width] duration-150"
          style={{ width: `${Math.round(score * 100)}%` }}
        />
      </div>
    </div>
  );
}

export function DebugHud({ state }: { state: FallSourceState }) {
  const { features, scores } = state;
  const weights = FALL_CONFIG.confidence.weights;

  return (
    <Card
      title="Developer diagnostics"
      action={
        <span className="shrink-0 font-mono text-[11px] text-slate-400 dark:text-slate-500">
          {state.runtimeMode
            ? `${state.runtimeMode} · ${state.delegate}`
            : "not started"}
        </span>
      }
      bodyClassName="px-4 pb-4"
    >
      <div className="grid gap-x-8 gap-y-1.5 text-sm sm:grid-cols-2">
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
          label="Vertical drop"
          value={features ? features.verticalDrop.toFixed(3) : "—"}
        />
        <Row label="Persistence" value={`${Math.round(state.persistenceMs)} ms`} />
        <Row label="Fall score" value={`${Math.round(state.confidence * 100)}%`} />
        <Row label="FPS" value={`${state.fps}`} />
        <Row label="Inference" value={`${state.inferenceMs.toFixed(1)} ms`} />
      </div>

      <div className="mt-4 grid gap-x-8 gap-y-2 border-t border-slate-100 pt-3 sm:grid-cols-2 dark:border-slate-800">
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

      <p className="mt-3 text-[11px] leading-relaxed text-slate-400 dark:text-slate-500">
        Trigger at {Math.round(FALL_CONFIG.confidence.triggerThreshold * 100)}%
        after {FALL_CONFIG.stateMachine.persistenceMs} ms of held fall posture.
        Demonstration heuristic only — not a medically validated score.
      </p>
    </Card>
  );
}
