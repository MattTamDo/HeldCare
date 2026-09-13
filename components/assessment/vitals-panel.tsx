"use client";

import { useEffect, useRef, useState } from "react";

import type { VideoProof, Vitals } from "@/lib/assessment/types";
import HostCameraBridge from "@/components/phone-camera/host-camera-bridge";
import { readRuntimeConfig } from "@/lib/config/client";
import type { RuntimeConfig } from "@/lib/config/runtime";
import {
  STAGE_LABELS,
  configuredVitalsMode,
  createVitalsProvider,
  type VitalsProvider,
  type VitalsSnapshot,
} from "@/lib/vitals";
import { Panel, Stat } from "./ui";

const ACTIVE_STAGES = new Set(["initializing", "searching", "acquired", "measuring"]);
const SCAN_DURATION_SECONDS = 15;
type CameraSource = "laptop" | "phone" | "bridge";
type VideoProofClip = VideoProof & {
  url: string;
};
type MotionSample = {
  pixels: Uint8ClampedArray;
  stillCount: number;
};

function scanStatus(snapshot: VitalsSnapshot): string {
  if (snapshot.stage === "available") return "Baseline captured";
  if (snapshot.stage === "error") return "Processing backend unavailable";
  if (ACTIVE_STAGES.has(snapshot.stage)) return "Scan running";
  return "Waiting for scan";
}

function breathingStatus(snapshot: VitalsSnapshot): string {
  if (snapshot.vitals.respiration) return "Breathing sample ready";
  if (ACTIVE_STAGES.has(snapshot.stage)) return "Searching for breathing signal";
  return "No current breathing sample";
}

function qualityStatus(snapshot: VitalsSnapshot): string {
  if (snapshot.vitals.signalQuality) return snapshot.vitals.signalQuality;
  if (snapshot.validationHint) return snapshot.validationHint;
  return "Stationary capture required";
}

function faceSummary(vitals: Vitals): string {
  if (!vitals.face) return "No current face sample";
  const states = [
    vitals.face.expression,
    vitals.face.blinking ? "blinking" : undefined,
    vitals.face.talking ? "talking" : undefined,
  ].filter(Boolean);
  return states.length > 0 ? states.join(", ") : "Face sample ready";
}

function hrvDetails(vitals: Vitals): string {
  if (!vitals.hrv) return "No current HRV details";
  const parts = [
    vitals.hrv.meanNn ? `mean NN ${vitals.hrv.meanNn}ms` : undefined,
    vitals.hrv.sdnn ? `SDNN ${vitals.hrv.sdnn}ms` : undefined,
    vitals.hrv.baevsky ? `Baevsky ${vitals.hrv.baevsky}` : undefined,
    vitals.hrv.stable !== undefined
      ? vitals.hrv.stable
        ? "stable"
        : "stabilizing"
      : undefined,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : "HRV sample ready";
}

function countAvailableMetricGroups(vitals: Vitals): number {
  return [
    vitals.respiration,
    vitals.pulse,
    vitals.pressureWaveform?.length,
    vitals.hrv?.rmssd,
    vitals.face,
  ].filter(Boolean).length;
}

function PressureSparkline({ values }: { values?: number[] }) {
  const points = values ?? [];
  const width = 280;
  const height = 64;

  if (points.length === 0) {
    return <div className="mt-3 h-16 rounded-lg border border-edge bg-surface" />;
  }

  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const path = points
    .map((value, index) => {
      const x = (index / Math.max(points.length - 1, 1)) * width;
      const y = height - ((value - min) / span) * height;
      return `${index === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg
      role="img"
      aria-label="Relative arterial pressure waveform"
      viewBox={`0 0 ${width} ${height}`}
      className="mt-3 h-16 w-full rounded-lg border border-edge bg-surface"
      preserveAspectRatio="none"
    >
      <path d={path} fill="none" stroke="#38bdf8" strokeWidth="2" />
    </svg>
  );
}

function backendStatus(snapshot: VitalsSnapshot): string {
  if (snapshot.stage === "error") return "Processing backend unavailable";
  if (snapshot.stage === "available") return "Baseline ready";
  if (ACTIVE_STAGES.has(snapshot.stage)) return "Processing";
  return "Hosted UI only";
}

function pipelineLabel(config?: RuntimeConfig): string {
  if (!config) return "Checking APIs";
  return config.smartSpectra.configured
    ? "SmartSpectra API configured"
    : "Hosted UI only";
}

function cameraInputLabel(config?: RuntimeConfig): string {
  if (!config) return "Checking camera transport";
  if (config.smartSpectra.configured) return "Node SmartSpectra bridge";
  return config.livekit.configured
    ? "LiveKit video, 30fps requested"
    : "Local WebRTC video, 30fps requested";
}

function runModeLabel(snapshot: VitalsSnapshot, config?: RuntimeConfig): string {
  if (snapshot.stage === "error") return "Processing backend unavailable";
  if (config?.smartSpectra.configured && config.livekit.configured) {
    return "SmartSpectra + LiveKit ready";
  }
  if (config?.smartSpectra.configured) return "SmartSpectra ready";
  return backendStatus(snapshot);
}

function presageConnected(config?: RuntimeConfig, snapshot?: VitalsSnapshot): boolean {
  return Boolean(config?.smartSpectra.configured && snapshot?.stage !== "error");
}

function PresageConnectionBar({
  config,
  snapshot,
}: {
  config?: RuntimeConfig;
  snapshot: VitalsSnapshot;
}) {
  const connected = presageConnected(config, snapshot);
  const pending = !config;

  return (
    <div
      className={`mb-3 rounded-xl border px-3 py-2 ${
        connected
          ? "border-emerald-400/40 bg-emerald-500/10"
          : "border-rose-400/40 bg-rose-500/10"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span
            className={`h-2.5 w-2.5 rounded-full ${
              connected
                ? "bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.65)]"
                : "bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.55)]"
            }`}
          />
          <p className="text-[11px] font-semibold tracking-[0.16em] text-slate-300">
            PRESAGE CONNECTION
          </p>
        </div>
        <p
          className={`text-xs font-semibold ${
            connected ? "text-emerald-300" : "text-rose-300"
          }`}
        >
          {pending ? "CHECKING" : connected ? "ON" : "OFF"}
        </p>
      </div>
      <div
        className={`mt-2 h-1.5 rounded-full ${
          connected ? "bg-emerald-400" : "bg-rose-500"
        }`}
      />
    </div>
  );
}

function RecordedMetrics({ vitals }: { vitals: Vitals }) {
  const records = [
    {
      label: "Pulse",
      value: vitals.pulse ? `${vitals.pulse} bpm` : "--",
      recorded: vitals.pulse !== undefined,
    },
    {
      label: "Respiration",
      value: vitals.respiration ? `${vitals.respiration} brpm` : "--",
      recorded: vitals.respiration !== undefined,
    },
    {
      label: "Signal quality",
      value: vitals.signalQuality ?? "--",
      recorded: vitals.signalQuality !== undefined,
    },
    {
      label: "Pressure waveform",
      value: vitals.pressureWaveform?.length
        ? `${vitals.pressureWaveform.length} samples`
        : "--",
      recorded: Boolean(vitals.pressureWaveform?.length),
    },
    {
      label: "HRV RMSSD",
      value: vitals.hrv?.rmssd ? `${vitals.hrv.rmssd} ms` : "--",
      recorded: vitals.hrv?.rmssd !== undefined,
    },
    {
      label: "Face analysis",
      value: vitals.face ? faceSummary(vitals) : "--",
      recorded: vitals.face !== undefined,
    },
  ];

  return (
    <div className="mt-3 rounded-xl border border-edge bg-panel-2 p-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h3 className="text-[11px] font-semibold tracking-[0.16em] text-slate-400">
          RECORDED METRICS
        </h3>
        <span className="text-xs text-slate-500">
          {records.filter((record) => record.recorded).length}/{records.length}
        </span>
      </div>
      <div className="divide-y divide-edge overflow-hidden rounded-lg border border-edge">
        {records.map((record) => (
          <div
            key={record.label}
            className="grid grid-cols-[1fr_auto] items-center gap-3 bg-surface px-3 py-2"
          >
            <div className="flex min-w-0 items-center gap-2">
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${
                  record.recorded ? "bg-emerald-400" : "bg-slate-600"
                }`}
              />
              <p className="truncate text-xs text-slate-400">{record.label}</p>
            </div>
            <p className="text-right text-xs font-semibold tabular-nums text-slate-200">
              {record.value}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function WarningList({
  vitals,
  noMotion,
}: {
  vitals: Vitals;
  noMotion: boolean;
}) {
  const warnings = [
    noMotion
      ? "No visible camera movement detected. Confirm the feed is live and the resident is framed."
      : undefined,
    vitals.pulse !== undefined && vitals.pulse < 50
      ? `Low pulse estimate (${vitals.pulse} bpm). Recheck capture quality and escalate per facility protocol.`
      : undefined,
    vitals.respiration !== undefined && vitals.respiration < 10
      ? `Low breathing estimate (${vitals.respiration} brpm). Recheck capture quality and escalate per facility protocol.`
      : undefined,
  ].filter(Boolean);

  if (warnings.length === 0) return null;

  return (
    <div className="mb-3 rounded-xl border border-amber-400/35 bg-amber-500/10 px-3 py-2">
      <p className="text-[11px] font-semibold tracking-[0.16em] text-amber-200">
        CAPTURE WARNING
      </p>
      <ul className="mt-1 space-y-1">
        {warnings.map((warning) => (
          <li key={warning} className="text-xs leading-snug text-amber-100">
            {warning}
          </li>
        ))}
      </ul>
    </div>
  );
}

function RunMetric({
  label,
  value,
  unit,
  detail,
}: {
  label: string;
  value: string;
  unit?: string;
  detail: string;
}) {
  return (
    <div className="rounded-xl border border-edge bg-panel-2 px-3 py-3">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[10px] font-semibold tracking-[0.14em] text-slate-500">
          {label}
        </p>
        <p className="text-lg font-semibold tabular-nums text-slate-100">
          {value}
          {unit ? (
            <span className="ml-1 text-[11px] font-medium text-slate-500">
              {unit}
            </span>
          ) : null}
        </p>
      </div>
      <p className="mt-1 text-[11px] leading-snug text-slate-500">{detail}</p>
    </div>
  );
}

export default function VitalsPanel({
  onVitals,
  onVideoProof,
}: {
  onVitals: (vitals: Vitals) => void;
  onVideoProof?: (proof: VideoProof) => void;
}) {
  const providerRef = useRef<VitalsProvider | null>(null);
  const laptopVideoRef = useRef<HTMLVideoElement>(null);
  const motionVideoRef = useRef<HTMLVideoElement>(null);
  const motionSampleRef = useRef<MotionSample | undefined>(undefined);
  const laptopStreamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const proofChunksRef = useRef<BlobPart[]>([]);
  const proofStartedAtRef = useRef<number | undefined>(undefined);
  const proofUrlRef = useRef<string | undefined>(undefined);
  const mountedRef = useRef(false);
  const [snapshot, setSnapshot] = useState<VitalsSnapshot>({
    stage: "idle",
    vitals: {},
  });
  const [mode, setMode] = useState<"mock" | "live">("mock");
  const [runtime, setRuntime] = useState<RuntimeConfig>();
  const [cameraSource, setCameraSource] = useState<CameraSource>("laptop");
  const [laptopCameraStatus, setLaptopCameraStatus] = useState("Camera not started");
  const [scanStartedAt, setScanStartedAt] = useState<number>();
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [noMotionWarning, setNoMotionWarning] = useState(false);
  const [bridgeSessionId, setBridgeSessionId] = useState("mac-camera");
  const [bridgeStatus, setBridgeStatus] = useState("Bridge not connected");
  const [bridgePackets, setBridgePackets] = useState(0);
  const [videoProof, setVideoProof] = useState<VideoProofClip>();
  const [videoProofStatus, setVideoProofStatus] = useState("No proof recorded");
  const [recordingProof, setRecordingProof] = useState(false);
  const preferredSourceSetRef = useRef(false);

  // Kept in a ref so the subscription never needs re-creating.
  const onVitalsRef = useRef(onVitals);
  onVitalsRef.current = onVitals;

  useEffect(() => {
    mountedRef.current = true;
    const provider = createVitalsProvider();
    providerRef.current = provider;
    setMode(provider.mode);

    const unsubscribe = provider.subscribe?.((next) => {
      setSnapshot(next);
      if (next.stage === "available" && next.vitals.pulse) {
        onVitalsRef.current(next.vitals);
      }
    });

    return () => {
      mountedRef.current = false;
      unsubscribe?.();
      void provider.stop();
      laptopStreamRef.current?.getTracks().forEach((track) => track.stop());
      if (recorderRef.current?.state === "recording") recorderRef.current.stop();
      if (proofUrlRef.current) URL.revokeObjectURL(proofUrlRef.current);
      setCameraStream(null);
      providerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const handlePresageStream = (event: Event) => {
      const stream = (event as CustomEvent<MediaStream | null>).detail ?? null;
      setCameraStream(stream);
      if (laptopVideoRef.current) laptopVideoRef.current.srcObject = stream;
      setLaptopCameraStatus(
        stream ? "SmartSpectra camera connected" : "Camera not started",
      );
    };

    window.addEventListener("carefall:presage-stream", handlePresageStream);
    return () => {
      window.removeEventListener("carefall:presage-stream", handlePresageStream);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    readRuntimeConfig()
      .then((config) => {
        if (cancelled) return;
        setRuntime(config);
        if (config.smartSpectra.configured) {
          setMode("live");
          if (!preferredSourceSetRef.current) {
            preferredSourceSetRef.current = true;
            if (window.__carefallElectron?.isElectron) {
              setCameraSource("laptop");
            } else {
              laptopStreamRef.current?.getTracks().forEach((track) => track.stop());
              laptopStreamRef.current = null;
              setCameraStream(null);
              if (laptopVideoRef.current) laptopVideoRef.current.srcObject = null;
              setCameraSource("bridge");
            }
          }
        }
      })
      .catch(() => {
        if (!cancelled) setRuntime(undefined);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const running = ACTIVE_STAGES.has(snapshot.stage);
  const done = snapshot.stage === "available";

  useEffect(() => {
    if (!scanStartedAt || !running) return;
    const tick = () =>
      setElapsedSeconds(
        Math.min(
          SCAN_DURATION_SECONDS,
          Math.floor((Date.now() - scanStartedAt) / 1000),
        ),
      );
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [running, scanStartedAt]);

  useEffect(() => {
    const video = motionVideoRef.current;
    if (!video || !cameraStream) {
      setNoMotionWarning(false);
      motionSampleRef.current = undefined;
      return;
    }

    video.srcObject = cameraStream;
    void video.play().catch(() => {});
    setNoMotionWarning(false);
    motionSampleRef.current = undefined;

    const canvas = document.createElement("canvas");
    canvas.width = 32;
    canvas.height = 18;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    const timer = window.setInterval(() => {
      if (!ctx || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      const previous = motionSampleRef.current;

      if (!previous) {
        motionSampleRef.current = { pixels: new Uint8ClampedArray(pixels), stillCount: 0 };
        return;
      }

      let diff = 0;
      for (let i = 0; i < pixels.length; i += 16) {
        diff += Math.abs(pixels[i] - previous.pixels[i]);
      }

      const avgDiff = diff / (pixels.length / 16);
      const stillCount = avgDiff < 2.2 ? previous.stillCount + 1 : 0;
      motionSampleRef.current = {
        pixels: new Uint8ClampedArray(pixels),
        stillCount,
      };
      setNoMotionWarning(stillCount >= 8);
    }, 1000);

    return () => {
      window.clearInterval(timer);
      video.srcObject = null;
      motionSampleRef.current = undefined;
      setNoMotionWarning(false);
    };
  }, [cameraStream]);

  useEffect(() => {
    if (cameraSource !== "bridge" || !bridgeSessionId.trim()) return;

    const session = bridgeSessionId.trim();
    let cancelled = false;
    setBridgeStatus(`Polling ${session}`);

    const poll = async () => {
      try {
        const response = await fetch(`/api/mobile-health/${encodeURIComponent(session)}`, {
          cache: "no-store",
        });
        if (!response.ok) {
          if (!cancelled) setBridgeStatus(`Bridge API ${response.status}`);
          return;
        }

        const payload = (await response.json()) as {
          latest?: { vitals?: Vitals; source?: string; validation?: { label?: string } };
          packets?: number;
          updatedAt?: number;
        };

        if (!payload.latest?.vitals) {
          if (!cancelled) setBridgeStatus("Waiting for SmartSpectra bridge packets");
          return;
        }

        const vitals = payload.latest.vitals;
        const next = {
          stage: "available" as const,
          vitals,
          validationHint: payload.latest.validation?.label,
        };
        if (!cancelled) {
          setSnapshot(next);
          setBridgePackets(payload.packets ?? vitals.packets ?? 0);
          setBridgeStatus(
            payload.updatedAt
              ? `Synced ${Math.max(0, Math.round((Date.now() - payload.updatedAt) / 1000))}s ago`
              : `Synced from ${payload.latest.source ?? "SmartSpectra"}`,
          );
          onVitalsRef.current(vitals);
        }
      } catch (error) {
        if (!cancelled) {
          setBridgeStatus(
            error instanceof Error ? error.message : "Bridge polling failed",
          );
        }
      }
    };

    void poll();
    const timer = window.setInterval(poll, 1000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [bridgeSessionId, cameraSource]);

  const pulse = snapshot.vitals.pulse ? `${snapshot.vitals.pulse}` : "--";
  const respiration = snapshot.vitals.respiration
    ? `${snapshot.vitals.respiration}`
    : "--";
  const quality = snapshot.vitals.signalQuality ?? "--";
  const pressureSamples = snapshot.vitals.pressureWaveform?.length ?? 0;
  const hrvRmssd = snapshot.vitals.hrv?.rmssd
    ? `${snapshot.vitals.hrv.rmssd}`
    : "--";
  const faceValue = snapshot.vitals.face ? "READY" : "--";
  const packets = snapshot.vitals.packets ? `${snapshot.vitals.packets}` : "0";
  const scanTime = snapshot.vitals.scanSeconds
    ? `${snapshot.vitals.scanSeconds}s`
    : running
      ? `${elapsedSeconds}s / ${SCAN_DURATION_SECONDS}s`
      : `0s / ${SCAN_DURATION_SECONDS}s`;
  const metricCount = countAvailableMetricGroups(snapshot.vitals);
  const proofSource: VideoProof["source"] =
    cameraSource === "phone"
      ? "phone"
      : window.__carefallElectron?.isElectron
        ? "smartspectra"
        : "laptop";

  function supportedVideoMimeType(): string {
    const candidates = [
      "video/webm;codecs=vp9",
      "video/webm;codecs=vp8",
      "video/webm",
      "video/mp4",
    ];
    return (
      candidates.find((type) => MediaRecorder.isTypeSupported(type)) ??
      "video/webm"
    );
  }

  function stopVideoProof() {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  }

  function startVideoProof() {
    if (!cameraStream) {
      setVideoProofStatus("Start a laptop or phone camera feed first.");
      return;
    }
    if (!("MediaRecorder" in window)) {
      setVideoProofStatus("Video proof recording is not supported here.");
      return;
    }

    if (proofUrlRef.current) URL.revokeObjectURL(proofUrlRef.current);
    proofUrlRef.current = undefined;
    setVideoProof(undefined);
    proofChunksRef.current = [];
    proofStartedAtRef.current = Date.now();

    const mimeType = supportedVideoMimeType();
    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(cameraStream, { mimeType });
    } catch {
      setVideoProofStatus("Video proof recording is not available for this stream.");
      return;
    }
    recorderRef.current = recorder;

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) proofChunksRef.current.push(event.data);
    };
    recorder.onstop = () => {
      if (!mountedRef.current) return;
      const capturedAt = proofStartedAtRef.current ?? Date.now();
      const durationSeconds = Math.max(
        1,
        Math.round((Date.now() - capturedAt) / 1000),
      );
      const blob = new Blob(proofChunksRef.current, { type: mimeType });
      const url = URL.createObjectURL(blob);
      proofUrlRef.current = url;
      const fileName = `carefall-proof-${capturedAt}.${mimeType.includes("mp4") ? "mp4" : "webm"}`;
      const proof: VideoProofClip = {
        id: `${capturedAt}-${blob.size}`,
        capturedAt,
        durationSeconds,
        sizeBytes: blob.size,
        mimeType,
        source: proofSource,
        fileName,
        url,
      };
      setRecordingProof(false);
      setVideoProof(proof);
      setVideoProofStatus(
        `${durationSeconds}s proof captured · ${(blob.size / 1024 / 1024).toFixed(1)} MB`,
      );
      onVideoProof?.({
        id: proof.id,
        capturedAt: proof.capturedAt,
        durationSeconds: proof.durationSeconds,
        sizeBytes: proof.sizeBytes,
        mimeType: proof.mimeType,
        source: proof.source,
        fileName: proof.fileName,
      });
    };
    recorder.onerror = () => {
      if (!mountedRef.current) return;
      setRecordingProof(false);
      setVideoProofStatus("Video proof recording failed.");
    };

    recorder.start(1000);
    setRecordingProof(true);
    setVideoProofStatus("Recording proof");
  }

  async function handleStart() {
    if (cameraSource === "bridge") {
      setSnapshot((current) => ({
        ...current,
        stage: current.vitals.pulse || current.vitals.respiration ? "available" : "searching",
        validationHint:
          current.vitals.pulse || current.vitals.respiration
            ? current.validationHint
            : "Waiting for SmartSpectra Node bridge packets.",
      }));
      setBridgeStatus(`Polling ${bridgeSessionId.trim() || "mac-camera"}`);
      return;
    }

    try {
      setElapsedSeconds(0);
      setScanStartedAt(Date.now());
      await providerRef.current?.start();
    } catch {
      // The provider already emitted an error snapshot; nothing more to do.
    }
  }

  async function startLaptopCamera() {
    if (window.__carefallElectron?.isElectron) {
      setLaptopCameraStatus("Starting SmartSpectra camera");
      await handleStart();
      return;
    }

    setLaptopCameraStatus("Requesting laptop camera");
    try {
      laptopStreamRef.current?.getTracks().forEach((track) => track.stop());
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: "user",
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            frameRate: { ideal: 30 },
          },
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: true,
        });
      }
      laptopStreamRef.current = stream;
      setCameraStream(stream);
      if (laptopVideoRef.current) laptopVideoRef.current.srcObject = stream;

      const [track] = stream.getVideoTracks();
      const settings = track?.getSettings();
      const width = settings?.width ? `${settings.width}` : "--";
      const height = settings?.height ? `${settings.height}` : "--";
      const fps = settings?.frameRate ? `${Math.round(settings.frameRate)}` : "--";
      setLaptopCameraStatus(`${width} x ${height} at ${fps}fps`);
    } catch (error) {
      setLaptopCameraStatus(
        error instanceof Error ? error.message : "Laptop camera unavailable",
      );
    }
  }

  return (
    <Panel
      title="CONTACTLESS MEASUREMENT"
      action={
        <span className="rounded-full border border-edge px-2 py-0.5 text-[10px] font-semibold tracking-wider text-slate-500">
          {mode.toUpperCase()}
        </span>
      }
    >
      <PresageConnectionBar config={runtime} snapshot={snapshot} />
      <video ref={motionVideoRef} muted playsInline className="hidden" />

      <p className="mb-3 text-sm text-slate-400">
        {snapshot.stage === "error"
          ? (snapshot.error ?? STAGE_LABELS.error)
          : STAGE_LABELS[snapshot.stage]}
      </p>
      {snapshot.validationHint && snapshot.stage !== "error" ? (
        <p className="mb-3 rounded-xl border border-amber-400/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
          {snapshot.validationHint}
        </p>
      ) : null}
      <WarningList vitals={snapshot.vitals} noMotion={noMotionWarning} />

      <div className="grid grid-cols-2 gap-2">
        <RunMetric
          label="PULSE"
          value={pulse}
          unit="bpm"
          detail={scanStatus(snapshot)}
        />
        <RunMetric
          label="RESPIRATION"
          value={respiration}
          unit="brpm"
          detail={breathingStatus(snapshot)}
        />
        <RunMetric
          label="QUALITY"
          value={quality}
          detail={qualityStatus(snapshot)}
        />
        <RunMetric
          label="FACE ANALYSIS"
          value={faceValue}
          detail={faceSummary(snapshot.vitals)}
        />
        <RunMetric
          label="SCAN TIME"
          value={scanTime}
          detail="Baseline saves when respiratory and pulse estimates are ready"
        />
        <RunMetric
          label="PRESSURE WAVEFORM"
          value={pressureSamples > 0 ? `${pressureSamples}` : "--"}
          detail={pressureSamples > 0 ? "Relative trace samples ready" : "No current waveform"}
        />
        <RunMetric
          label="OPTIONAL HRV"
          value={hrvRmssd}
          unit="ms"
          detail={snapshot.vitals.hrv ? "RMSSD sample ready" : "No current HRV sample"}
        />
        <RunMetric
          label="HRV DETAILS"
          value={snapshot.vitals.hrv?.confidence ? `${Math.round(snapshot.vitals.hrv.confidence * 100)}%` : "--"}
          detail={hrvDetails(snapshot.vitals)}
        />
      </div>

      <div className="mt-3 rounded-xl border border-edge bg-panel-2 p-3">
        <h3 className="text-[11px] font-semibold tracking-[0.16em] text-slate-400">
          RUN MODE
        </h3>
        <p className="mt-2 text-sm font-semibold text-slate-200">
          {runModeLabel(snapshot, runtime)}
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Stat label="PIPELINE" value={pipelineLabel(runtime)} />
          <Stat label="CAMERA INPUT" value={cameraInputLabel(runtime)} />
          <Stat label="METRICS" value={metricCount > 0 ? `${metricCount}` : "--"} />
          <Stat label="PACKETS" value={packets} />
        </div>
        {runtime?.livekit.configured ? (
          <p className="mt-2 truncate text-[11px] text-slate-500">
            LiveKit URL connected: {runtime.livekit.url}
          </p>
        ) : null}
      </div>

      <div className="mt-3 rounded-xl border border-edge bg-panel-2 p-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-[11px] font-semibold tracking-[0.16em] text-slate-400">
            RELATIVE ARTERIAL PRESSURE
          </h3>
          <span className="text-xs tabular-nums text-slate-500">
            {pressureSamples} samples
          </span>
        </div>
        <PressureSparkline values={snapshot.vitals.pressureWaveform} />
      </div>

      <RecordedMetrics vitals={snapshot.vitals} />

      <div className="mt-3 rounded-xl border border-edge bg-panel-2 p-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-[11px] font-semibold tracking-[0.16em] text-slate-400">
              VIDEO PROOF
            </h3>
            <p className="mt-1 text-xs text-slate-500">{videoProofStatus}</p>
          </div>
          <span
            className={`rounded-full border px-2 py-1 text-[10px] font-semibold ${
              recordingProof
                ? "border-rose-400/40 text-rose-200"
                : videoProof
                  ? "border-emerald-400/40 text-emerald-200"
                  : "border-edge text-slate-500"
            }`}
          >
            {recordingProof ? "REC" : videoProof ? "SAVED" : "READY"}
          </span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={recordingProof ? stopVideoProof : startVideoProof}
            disabled={!cameraStream && !recordingProof}
            className="rounded-lg border border-sky-400/40 px-3 py-2 text-xs font-semibold text-sky-100 transition hover:bg-sky-500/15 disabled:border-edge disabled:text-slate-600"
          >
            {recordingProof ? "STOP PROOF" : "RECORD PROOF"}
          </button>
          {videoProof ? (
            <a
              href={videoProof.url}
              download={videoProof.fileName}
              className="rounded-lg border border-emerald-400/40 px-3 py-2 text-center text-xs font-semibold text-emerald-100 transition hover:bg-emerald-500/15"
            >
              DOWNLOAD
            </a>
          ) : (
            <button
              type="button"
              disabled
              className="rounded-lg border border-edge px-3 py-2 text-xs font-semibold text-slate-600"
            >
              DOWNLOAD
            </button>
          )}
        </div>
      </div>

        {done ? (
          <p className="mt-3 text-[11px] text-slate-500">
            Estimates from a signal measurement. Not a diagnosis.
          </p>
      ) : null}

      <button
        type="button"
        onClick={handleStart}
        disabled={running}
        className="mt-3 w-full rounded-xl border border-sky-400/40 bg-sky-500/15 px-4 py-3 text-sm font-semibold text-sky-100 transition hover:bg-sky-500/25 disabled:opacity-50"
      >
        {cameraSource === "bridge"
          ? done
            ? "SMARTSPECTRA BRIDGE ACTIVE"
            : "CONNECT SMARTSPECTRA BRIDGE"
          : running
          ? "MEASURING…"
          : done
            ? "MEASURE AGAIN"
            : "START CONTACTLESS ASSESSMENT"}
      </button>

      {snapshot.stage === "error" && configuredVitalsMode() === "live" ? (
        <p className="mt-2 text-[11px] text-amber-400/80">
          Live provider failed
          {snapshot.errorCode !== undefined ? ` (${snapshot.errorCode})` : ""}.
          {snapshot.retryable ? " Retryable." : " Set NEXT_PUBLIC_PRESAGE_MODE=mock for the demo."}
        </p>
      ) : null}

      <div className="mt-3 rounded-xl border border-edge bg-panel-2 p-3">
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => setCameraSource("laptop")}
            aria-pressed={cameraSource === "laptop"}
            className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${
              cameraSource === "laptop"
                ? "border-sky-400 bg-sky-500/15 text-sky-100"
                : "border-edge bg-surface text-slate-400 hover:border-slate-500"
            }`}
          >
            USE LAPTOP CAMERA
          </button>
          <button
            type="button"
            onClick={() => setCameraSource("phone")}
            aria-pressed={cameraSource === "phone"}
            className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${
              cameraSource === "phone"
                ? "border-sky-400 bg-sky-500/15 text-sky-100"
                : "border-edge bg-surface text-slate-400 hover:border-slate-500"
            }`}
          >
            USE PHONE CAMERA
          </button>
          <button
            type="button"
            onClick={() => {
              laptopStreamRef.current?.getTracks().forEach((track) => track.stop());
              laptopStreamRef.current = null;
              setCameraStream(null);
              if (laptopVideoRef.current) laptopVideoRef.current.srcObject = null;
              setCameraSource("bridge");
            }}
            aria-pressed={cameraSource === "bridge"}
            className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${
              cameraSource === "bridge"
                ? "border-emerald-400 bg-emerald-500/15 text-emerald-100"
                : "border-edge bg-surface text-slate-400 hover:border-slate-500"
            }`}
          >
            USE SMARTSPECTRA BRIDGE
          </button>
        </div>

        {cameraSource === "laptop" ? (
          <div className="mt-3">
            <video
              ref={laptopVideoRef}
              autoPlay
              playsInline
              muted
              className="aspect-video w-full rounded-lg border border-edge bg-black object-cover"
            />
            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="text-xs text-slate-500">{laptopCameraStatus}</p>
              <button
                type="button"
                onClick={startLaptopCamera}
                className="shrink-0 rounded-lg border border-sky-400/40 px-3 py-2 text-xs font-semibold text-sky-100 transition hover:bg-sky-500/15"
              >
                START CAMERA
              </button>
            </div>
          </div>
        ) : cameraSource === "phone" ? (
          <div className="mt-3">
            <HostCameraBridge
              recordedVitals={snapshot.vitals}
              onMobileVitals={(vitals) => {
                const next = { stage: "available" as const, vitals };
                setSnapshot(next);
                onVitalsRef.current(vitals);
              }}
              onStream={(stream) => {
                setCameraStream(stream);
                console.info(
                  "[phone-camera] remote stream ready for Presage useMediaStream()",
                  stream,
                );
              }}
            />
          </div>
        ) : (
          <div className="mt-3 rounded-xl border border-emerald-400/20 bg-emerald-500/10 p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold tracking-[0.16em] text-emerald-200">
                  SMARTSPECTRA NODE BRIDGE
                </p>
                <p className="mt-1 text-xs text-slate-400">{bridgeStatus}</p>
              </div>
              <span className="rounded-full border border-emerald-400/30 px-2 py-1 text-xs font-semibold text-emerald-100">
                {bridgePackets || packets} packets
              </span>
            </div>
            <label className="mt-3 block text-[11px] font-semibold tracking-[0.14em] text-slate-500">
              SESSION ID
              <input
                value={bridgeSessionId}
                onChange={(event) => setBridgeSessionId(event.target.value)}
                className="mt-1 w-full rounded-lg border border-edge bg-surface px-3 py-2 text-sm font-semibold text-slate-100 outline-none focus:border-emerald-400/70"
              />
            </label>
            <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
              Run this in a separate terminal without opening the browser laptop
              camera:
              <br />
              <code className="text-emerald-100">
                SMARTSPECTRA_BRIDGE_SESSION_ID={bridgeSessionId || "mac-camera"} npm run presage:camera-bridge
              </code>
            </p>
          </div>
        )}

        <div className="mt-3 overflow-hidden rounded-lg border border-edge">
          {[
            ["Mac built-in camera", "1280 x 720 on older Macs, 1920 x 1080 on newer Macs"],
            ["iPhone front camera", "Often 1920 x 1080 video; photos around 4032 x 3024"],
            ["iPhone rear camera", "Commonly 4032 x 3024 photos; 3840 x 2160 for 4K video"],
          ].map(([device, resolution]) => (
            <div
              key={device}
              className="grid grid-cols-[0.9fr_1.1fr] border-b border-edge last:border-b-0"
            >
              <div className="bg-surface px-3 py-2 text-[11px] font-semibold text-slate-400">
                {device}
              </div>
              <div className="px-3 py-2 text-[11px] leading-snug text-slate-500">
                {resolution}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Panel>
  );
}
