"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { FALL_CONFIG, FRAME_INTERVAL_MS } from "@/lib/fall/config";
import { clearCanvas, drawPoseSkeleton } from "@/lib/fall/drawPose";
import { FallFeatureExtractor } from "@/lib/fall/fallFeatures";
import { FallStateMachine } from "@/lib/fall/fallStateMachine";
import { round } from "@/lib/fall/geometry";
import { createPoseDetector, type PoseDetector } from "@/lib/fall/poseClient";
import {
  createFallEvent,
  onFallReported,
  reportFall,
  resetFallDedupe,
  type ReportedFall,
} from "@/lib/fall/reportFall";
import type {
  FallFeatures,
  FallSignalScores,
  FallState,
  PoseLandmark,
  PoseRuntimeMode,
} from "@/lib/fall/types";

export type FallMonitorStatus = "idle" | "starting" | "running" | "error";

export type FallMonitorState = {
  status: FallMonitorStatus;
  error: string | null;
  runtimeMode: PoseRuntimeMode | null;
  delegate: "GPU" | "CPU" | null;
  fallState: FallState;
  confidence: number;
  scores: FallSignalScores;
  features: FallFeatures | null;
  persistenceMs: number;
  poseDetected: boolean;
  /** False until the first inference returns; the model warm-up can take seconds. */
  modelReady: boolean;
  fps: number;
  inferenceMs: number;
};

const EMPTY_SCORES: FallSignalScores = {
  rapidDescent: 0,
  horizontalTorso: 0,
  aspectRatio: 0,
  lowPosition: 0,
  persistence: 0,
};

const INITIAL_STATE: FallMonitorState = {
  status: "idle",
  error: null,
  runtimeMode: null,
  delegate: null,
  fallState: "UPRIGHT",
  confidence: 0,
  scores: EMPTY_SCORES,
  features: null,
  persistenceMs: 0,
  poseDetected: false,
  modelReady: false,
  fps: 0,
  inferenceMs: 0,
};

function describeCameraError(error: unknown): string {
  if (!(error instanceof Error)) return "Could not start the camera.";
  switch (error.name) {
    case "NotAllowedError":
    case "SecurityError":
      return "Camera permission was denied. Allow camera access in the browser address bar, then start again.";
    case "NotFoundError":
    case "OverconstrainedError":
      return "No camera was found on this device.";
    case "NotReadableError":
      return "The camera is already in use by another application.";
    default:
      return error.message || "Could not start the camera.";
  }
}

export function useFallMonitor(options: {
  roomId: string;
  residentId: string;
}) {
  const { roomId, residentId } = options;

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const extractorRef = useRef<FallFeatureExtractor | null>(null);
  const machineRef = useRef<FallStateMachine | null>(null);
  const detectorRef = useRef<PoseDetector | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const rafRef = useRef<number | null>(null);
  const runningRef = useRef(false);
  const busyRef = useRef(false);
  const lastInferenceAtRef = useRef(0);
  const lastTimestampRef = useRef(0);
  const inferenceTimesRef = useRef<number[]>([]);
  const lastFeaturesRef = useRef<FallFeatures | null>(null);

  const [state, setState] = useState<FallMonitorState>(INITIAL_STATE);
  const [reports, setReports] = useState<ReportedFall[]>([]);

  const extractor = () => {
    extractorRef.current ??= new FallFeatureExtractor();
    return extractorRef.current;
  };
  const machine = () => {
    machineRef.current ??= new FallStateMachine();
    return machineRef.current;
  };

  useEffect(
    () => onFallReported((report) => setReports((prev) => [report, ...prev])),
    [],
  );

  // -------------------------------------------------------------------------
  // Inference loop
  // -------------------------------------------------------------------------

  const handleSample = useCallback(
    (landmarks: PoseLandmark[] | null, t: number, inferenceMs: number) => {
      const video = videoRef.current;
      const frameAspect =
        video && video.videoHeight > 0
          ? video.videoWidth / video.videoHeight
          : 1;

      const features = landmarks
        ? extractor().push({ t, landmarks, frameAspect })
        : null;
      if (features) lastFeaturesRef.current = features;

      const snapshot = machine().update(features, t);

      const canvas = canvasRef.current;
      if (canvas && video) {
        if (
          canvas.width !== video.videoWidth ||
          canvas.height !== video.videoHeight
        ) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
        }
        if (landmarks) {
          drawPoseSkeleton(canvas, landmarks, {
            state: snapshot.state,
            centers: features?.centers ?? null,
          });
        } else {
          clearCanvas(canvas);
        }
      }

      if (snapshot.shouldEmit) {
        void reportFall(
          createFallEvent({
            roomId,
            residentId,
            confidence: snapshot.confidence,
            evidence: snapshot.evidence,
          }),
          "detector",
        );
      }

      const now = performance.now();
      const times = inferenceTimesRef.current;
      times.push(now);
      while (times.length > 0 && now - times[0] > 1000) times.shift();

      setState((prev) => ({
        ...prev,
        status: "running",
        fallState: snapshot.state,
        confidence: snapshot.confidence,
        scores: snapshot.scores,
        features: features ?? lastFeaturesRef.current,
        persistenceMs: snapshot.persistenceMs,
        poseDetected: features !== null,
        modelReady: true,
        fps: times.length,
        inferenceMs: round(inferenceMs, 1),
      }));
    },
    [residentId, roomId],
  );

  const loop = useCallback(async () => {
    if (!runningRef.current) return;

    const schedule = () => {
      if (runningRef.current) {
        rafRef.current = requestAnimationFrame(() => void loop());
      }
    };

    const video = videoRef.current;
    const detector = detectorRef.current;
    const now = performance.now();

    const notReady =
      !video ||
      !detector ||
      busyRef.current ||
      video.readyState < 2 ||
      video.videoWidth === 0;
    if (notReady || now - lastInferenceAtRef.current < FRAME_INTERVAL_MS) {
      schedule();
      return;
    }

    busyRef.current = true;
    lastInferenceAtRef.current = now;
    // MediaPipe requires strictly increasing video timestamps.
    const timestamp = Math.max(now, lastTimestampRef.current + 1);
    lastTimestampRef.current = timestamp;

    const startedAt = performance.now();
    try {
      const sample = await detector.detect(video, timestamp);
      handleSample(sample.landmarks, sample.t, performance.now() - startedAt);
    } catch (error) {
      console.warn("[CareFall] pose inference failed", error);
    } finally {
      busyRef.current = false;
      schedule();
    }
  }, [handleSample]);

  // -------------------------------------------------------------------------
  // Camera lifecycle
  // -------------------------------------------------------------------------

  const stop = useCallback(() => {
    runningRef.current = false;
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;

    const video = videoRef.current;
    if (video) video.srcObject = null;

    detectorRef.current?.close();
    detectorRef.current = null;

    const canvas = canvasRef.current;
    if (canvas) clearCanvas(canvas);

    busyRef.current = false;
    inferenceTimesRef.current = [];
    extractorRef.current?.reset();

    setState((prev) => ({
      ...INITIAL_STATE,
      fallState: prev.fallState === "CONFIRMED_FALL" ? "CONFIRMED_FALL" : "UPRIGHT",
    }));
  }, []);

  const start = useCallback(async () => {
    if (runningRef.current) return;
    setState((prev) => ({ ...prev, status: "starting", error: null }));

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: true });
    } catch (error) {
      setState((prev) => ({
        ...prev,
        status: "error",
        error: describeCameraError(error),
      }));
      return;
    }
    streamRef.current = stream;

    const video = videoRef.current;
    if (!video) {
      stream.getTracks().forEach((track) => track.stop());
      setState((prev) => ({
        ...prev,
        status: "error",
        error: "Video element is not mounted.",
      }));
      return;
    }

    video.srcObject = stream;
    try {
      await video.play();
    } catch {
      // Autoplay can reject even when the stream is live; the loop waits for
      // readyState, so this is not fatal.
    }

    try {
      const detector = await createPoseDetector();
      detectorRef.current = detector;
      setState((prev) => ({
        ...prev,
        runtimeMode: detector.mode,
        delegate: detector.delegate,
      }));
    } catch (error) {
      stream.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      video.srcObject = null;
      setState((prev) => ({
        ...prev,
        status: "error",
        error:
          error instanceof Error
            ? `Pose model failed to load: ${error.message}`
            : "Pose model failed to load.",
      }));
      return;
    }

    extractor().reset();
    lastInferenceAtRef.current = 0;
    lastTimestampRef.current = 0;
    runningRef.current = true;
    setState((prev) => ({ ...prev, status: "running" }));
    rafRef.current = requestAnimationFrame(() => void loop());
  }, [loop]);

  useEffect(() => stop, [stop]);

  // -------------------------------------------------------------------------
  // Manual controls
  // -------------------------------------------------------------------------

  const resetDetector = useCallback(() => {
    machine().reset();
    extractor().reset();
    resetFallDedupe();
    lastFeaturesRef.current = null;
    setState((prev) => ({
      ...prev,
      fallState: "UPRIGHT",
      confidence: 0,
      scores: EMPTY_SCORES,
      persistenceMs: 0,
    }));
  }, []);

  /**
   * Manual fallback (`F` key / demo button). Goes through the same
   * `reportFall` contract as the detector — there is no separate path.
   */
  const triggerManualFall = useCallback(() => {
    const t = performance.now();
    const snapshot = machine().forceConfirm(t);
    const features = lastFeaturesRef.current;

    void reportFall(
      createFallEvent({
        roomId,
        residentId,
        confidence: 1,
        evidence: features
          ? {
              torsoAngle: round(features.torsoAngle, 0),
              hipVelocity: round(features.hipVelocity, 2),
              aspectRatio: round(features.aspectRatio, 2),
              persistenceMs: FALL_CONFIG.stateMachine.persistenceMs,
            }
          : { persistenceMs: FALL_CONFIG.stateMachine.persistenceMs },
      }),
      "manual",
    );

    setState((prev) => ({
      ...prev,
      fallState: snapshot.state,
      confidence: 1,
      persistenceMs: FALL_CONFIG.stateMachine.persistenceMs,
    }));
  }, [residentId, roomId]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "f" && event.key !== "F") return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.isContentEditable ||
          ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
      ) {
        return;
      }
      event.preventDefault();
      triggerManualFall();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [triggerManualFall]);

  const lastReport = useMemo(() => reports[0] ?? null, [reports]);

  return {
    videoRef,
    canvasRef,
    state,
    reports,
    lastReport,
    eventCount: reports.length,
    start,
    stop,
    resetDetector,
    triggerManualFall,
  };
}
