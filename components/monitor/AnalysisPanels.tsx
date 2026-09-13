"use client";

import type { FallSourceState } from "@/hooks/useFallSource";
import { Card } from "@/components/ui/Card";
import {
  ActivityIcon,
  AlertIcon,
  EyeIcon,
  HeartIcon,
  InfoIcon,
  PersonIcon,
} from "@/components/ui/icons";
import { FALL_CONFIG } from "@/lib/fall/config";

type Tone = "idle" | "good" | "warn" | "alert";

const ROW_TONE: Record<Tone, string> = {
  idle: "bg-slate-50 dark:bg-slate-800/50",
  good: "bg-emerald-50/70 dark:bg-emerald-500/10",
  warn: "bg-amber-50/70 dark:bg-amber-500/10",
  alert: "bg-rose-50/70 dark:bg-rose-500/10",
};

const ICON_TONE: Record<Tone, string> = {
  idle: "bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-300",
  good: "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-300",
  warn: "bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-300",
  alert: "bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-300",
};

const VALUE_TONE: Record<Tone, string> = {
  idle: "text-slate-500 dark:text-slate-400",
  good: "text-emerald-700 dark:text-emerald-300",
  warn: "text-amber-700 dark:text-amber-300",
  alert: "text-rose-700 dark:text-rose-300",
};

function AnalysisRow({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: Tone;
}) {
  return (
    <div className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${ROW_TONE[tone]}`}>
      <span className={`grid size-8 shrink-0 place-items-center rounded-full ${ICON_TONE[tone]}`}>
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold">{label}</span>
        <span className={`block truncate text-xs font-medium ${VALUE_TONE[tone]}`}>
          {value}
        </span>
      </span>
    </div>
  );
}

/** Every row is derived from the live detector — nothing here is simulated. */
export function AiAnalysisCard({ state }: { state: FallSourceState }) {
  const running = state.status === "running";
  const score = Math.round(state.confidence * 100);
  const features = state.features;

  // A confirmed fall outranks the camera state: a manual report still counts.
  const fall: { value: string; tone: Tone } =
    state.fallState === "CONFIRMED_FALL"
      ? { value: `Fall detected (${score}% confidence)`, tone: "alert" }
      : !running
        ? { value: "Detector idle", tone: "idle" }
        : state.fallState === "POSSIBLE_FALL"
        ? { value: `Possible fall (${score}%)`, tone: "warn" }
        : state.fallState === "DESCENDING"
          ? { value: `Rapid movement (${score}%)`, tone: "warn" }
          : { value: "No fall detected", tone: "good" };

  const person: { value: string; tone: Tone } = !running
    ? { value: "Not monitoring", tone: "idle" }
    : state.poseDetected
      ? { value: "1 person", tone: "good" }
      : { value: "No person in view", tone: "idle" };

  const still =
    features !== null &&
    Math.abs(features.hipVelocity) < FALL_CONFIG.velocity.quietThreshold;

  const response: { value: string; tone: Tone } = !running
    ? { value: "Not monitoring", tone: "idle" }
    : state.fallState === "CONFIRMED_FALL"
      ? still
        ? { value: "No movement detected", tone: "alert" }
        : { value: "Movement detected", tone: "warn" }
      : state.poseDetected
        ? { value: still ? "Resident is still" : "Normal activity", tone: "good" }
        : { value: "Waiting for a person", tone: "idle" };

  const visibility = features?.poseConfidence ?? 0;
  const environment: { value: string; tone: Tone } = !running
    ? { value: "Camera off", tone: "idle" }
    : !state.poseDetected
      ? { value: "Nothing tracked", tone: "idle" }
      : visibility >= 0.7
        ? { value: `Clear view · ${state.fps} fps tracking`, tone: "good" }
        : visibility >= FALL_CONFIG.pose.minPoseConfidence
          ? { value: `Partial view · ${state.fps} fps tracking`, tone: "warn" }
          : { value: "Poor visibility", tone: "warn" };

  return (
    <Card
      title="AI analysis"
      icon={<ActivityIcon className="size-4 text-sky-500" />}
      action={
        <span className="flex shrink-0 items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
          <span
            className={`size-2 rounded-full ${
              running ? "animate-dot-pulse bg-emerald-500" : "bg-slate-300 dark:bg-slate-600"
            }`}
          />
          {running ? "Live" : "Idle"}
        </span>
      }
      bodyClassName="space-y-2 px-4 pb-4"
    >
      <AnalysisRow
        icon={<AlertIcon className="size-4" />}
        label="Fall detection"
        value={fall.value}
        tone={fall.tone}
      />
      <AnalysisRow
        icon={<PersonIcon className="size-4" />}
        label="Person detected"
        value={person.value}
        tone={person.tone}
      />
      <AnalysisRow
        icon={<ActivityIcon className="size-4" />}
        label="Response check"
        value={response.value}
        tone={response.tone}
      />
      <AnalysisRow
        icon={<EyeIcon className="size-4" />}
        label="Environment"
        value={environment.value}
        tone={environment.tone}
      />
    </Card>
  );
}

function VitalRow({
  label,
  value,
  badge,
}: {
  label: string;
  value: string;
  badge: string;
}) {
  return (
    <div className="flex items-end justify-between gap-3 border-b border-slate-100 pb-2.5 last:border-0 last:pb-0 dark:border-slate-800">
      <span>
        <span className="block text-xs text-slate-500 dark:text-slate-400">{label}</span>
        <span className="block font-mono text-lg leading-tight font-semibold text-slate-400 dark:text-slate-500">
          {value}
        </span>
      </span>
      <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
        {badge}
      </span>
    </div>
  );
}

/**
 * The camera cannot measure vitals, so this card stays empty until a radar or
 * wearable is connected. Showing invented numbers next to a real detector
 * would make the demo look like it measures things it does not.
 */
export function VitalSignsCard({ state }: { state: FallSourceState }) {
  const features = state.features;
  const movement =
    state.status !== "running" || !state.poseDetected
      ? "—"
      : features && Math.abs(features.hipVelocity) < FALL_CONFIG.velocity.quietThreshold
        ? "Still"
        : "Moving";

  return (
    <Card
      title="Vital signs"
      icon={<HeartIcon className="size-4 text-rose-500" />}
      action={
        <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
          Optional
        </span>
      }
      bodyClassName="space-y-2.5 px-4 pb-4"
    >
      <VitalRow label="Heart rate" value="—" badge="No device" />
      <VitalRow label="Respiration" value="—" badge="No device" />

      <div className="flex items-end justify-between gap-3 border-b border-slate-100 pb-2.5 dark:border-slate-800">
        <span>
          <span className="block text-xs text-slate-500 dark:text-slate-400">
            Movement (from camera)
          </span>
          <span className="block text-lg leading-tight font-semibold">{movement}</span>
        </span>
        <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30">
          Live
        </span>
      </div>

      <VitalRow label="Room temperature" value="—" badge="No device" />

      <p className="flex gap-2 pt-1 text-[11px] leading-relaxed text-slate-400 dark:text-slate-500">
        <InfoIcon className="mt-px size-3.5 shrink-0" />
        Vitals need a compatible radar or wearable. Only the movement row comes
        from the camera.
      </p>
    </Card>
  );
}
