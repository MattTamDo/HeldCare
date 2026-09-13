"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  FALL_CONFIG,
  frameIntervalMs,
  getMonitoredRoom,
  type CameraSourceConfig,
} from "@/lib/fall/config";
import { clearCanvas, drawPoseSkeleton } from "@/lib/fall/drawPose";
import { FallFeatureExtractor } from "@/lib/fall/fallFeatures";
import { FallStateMachine } from "@/lib/fall/fallStateMachine";
import { round } from "@/lib/fall/geometry";
import {
  acquirePoseRuntime,
  releasePoseRuntime,
  type PoseRuntime,
} from "@/lib/fall/poseClient";
import {
  createFallEvent,
  reportFall,
  resetFallDedupe,
} from "@/lib/fall/reportFall";
import type {
  FallFeatures,
  FallSignalScores,
  FallState,
  PoseLandmark,
  PoseRuntimeMode,
} from "@/lib/fall/types";

export type FallSourceStatus = "idle" | "starting" | "running" | "error";

export type FallSourceState = {
  status: FallSourceStatus;
  error: string | null;
  runtimeMode: PoseRuntimeMode | null;
  delegate: "GPU" | "CPU" | null;
  fallState: FallState;
  confidence: number;
  scores: FallSignalScores;
  features: FallFeatures | null;
  persistenceMs: number;
  poseDetected: boolean;
  /** False until the first inference returns; model warm-up can take seconds. */
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

const INITIAL_STATE: FallSourceState = {
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

/** Windows currently running, so they can share the inference budget. */
let activeSourceCount = 0;

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

export type ClipInfo = { name: string; uploaded: boolean };

export function useFallSource(source: CameraSourceConfig) {
  const room = getMonitoredRoom(source.roomId);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const extractorRef = useRef<FallFeatureExtractor | null>(null);
  const machineRef = useRef<FallStateMachine | null>(null);
  const runtimeRef = useRef<PoseRuntime | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  const rafRef = useRef<number | null>(null);
  const runningRef = useRef(false);
  const countedRef = useRef(false);
  const busyRef = useRef(false);
  const lastInferenceAtRef = useRef(0);
  const lastTimestampRef = useRef(0);
  const lastVideoTimeRef = useRef(-1);
  const videoTimeBaseRef = useRef(0);
  const inferenceTimesRef = useRef<number[]>([]);
  const lastFeaturesRef = useRef<FallFeatures | null>(null);

  const [state, setState] = useState<FallSourceState>(INITIAL_STATE);
  const [videoSrc, setVideoSrc] = useState<string | null>(
    source.kind === "video" ? (source.defaultSrc ?? null) : null,
  );
  const [clip, setClip] = useState<ClipInfo | null>(
    source.kind === "video" && source.defaultSrc
      ? { name: source.defaultSrc.split("/").pop() ?? "clip", uploaded: false }
      : null,
  );
  const [clipUnavailable, setClipUnavailable] = useState(false);

  const extractor = () => {
    extractorRef.current ??= new FallFeatureExtractor();
    return extractorRef.current;
  };
  const machine = () => {
    machineRef.current ??= new FallStateMachine();
    return machineRef.current;
  };

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
            roomId: room.roomId,
            residentId: room.residentId,
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
    [room.residentId, room.roomId],
  );

  const loop = useCallback(async () => {
    if (!runningRef.current) return;

    const schedule = () => {
      if (runningRef.current) {
        rafRef.current = requestAnimationFrame(() => void loop());
      }
    };

    const video = videoRef.current;
    const runtime = runtimeRef.current;
    const now = performance.now();

    const notReady =
      !video ||
      !runtime ||
      busyRef.current ||
      video.readyState < 2 ||
      video.videoWidth === 0;
    if (notReady || now - lastInferenceAtRef.current < frameIntervalMs(activeSourceCount)) {
      schedule();
      return;
    }

    let timestamp: number;
    if (source.kind === "video") {
      // A paused clip has nothing new to analyse.
      if (video.paused || video.ended) {
        schedule();
        return;
      }
      // Clip time keeps velocity honest even when inference runs slower than
      // the clip's frame rate.
      const videoTime = video.currentTime * 1000;
      if (videoTime <= lastVideoTimeRef.current) {
        schedule();
        return;
      }
      lastVideoTimeRef.current = videoTime;
      timestamp = videoTime + videoTimeBaseRef.current;
    } else {
      timestamp = Math.max(now, lastTimestampRef.current + 1);
    }
    // MediaPipe requires strictly increasing timestamps per source.
    if (timestamp <= lastTimestampRef.current) {
      timestamp = lastTimestampRef.current + 1;
    }
    lastTimestampRef.current = timestamp;

    busyRef.current = true;
    lastInferenceAtRef.current = now;

    const startedAt = performance.now();
    try {
      const sample = await runtime.detect(source.id, video, timestamp);
      handleSample(sample.landmarks, sample.t, performance.now() - startedAt);
    } catch (error) {
      console.warn(`[CareFall] pose inference failed (${source.id})`, error);
    } finally {
      busyRef.current = false;
      schedule();
    }
  }, [handleSample, source.id, source.kind]);

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  const stop = useCallback(() => {
    runningRef.current = false;
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (countedRef.current) {
      activeSourceCount = Math.max(0, activeSourceCount - 1);
      countedRef.current = false;
    }

    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;

    const video = videoRef.current;
    if (video) {
      if (source.kind === "live") video.srcObject = null;
      else video.pause();
    }

    if (runtimeRef.current) {
      releasePoseRuntime(source.id);
      runtimeRef.current = null;
    }

    const canvas = canvasRef.current;
    if (canvas) clearCanvas(canvas);

    busyRef.current = false;
    inferenceTimesRef.current = [];
    extractorRef.current?.reset();

    setState((prev) => ({
      ...INITIAL_STATE,
      fallState:
        prev.fallState === "CONFIRMED_FALL" ? "CONFIRMED_FALL" : "UPRIGHT",
    }));
  }, [source.id, source.kind]);

  const start = useCallback(async () => {
    if (runningRef.current) return;

    const video = videoRef.current;
    if (!video) return;

    setState((prev) => ({ ...prev, status: "starting", error: null }));

    if (source.kind === "live") {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
        });
        streamRef.current = stream;
        video.srcObject = stream;
      } catch (error) {
        setState((prev) => ({
          ...prev,
          status: "error",
          error: describeCameraError(error),
        }));
        return;
      }
    } else if (!videoSrc) {
      setState((prev) => ({
        ...prev,
        status: "error",
        error: "Choose a video file to analyse.",
      }));
      return;
    }

    try {
      await video.play();
    } catch {
      // Autoplay can reject even when the source is live; the loop waits for
      // readyState, so this is not fatal.
    }

    try {
      runtimeRef.current = await acquirePoseRuntime(source.id);
      setState((prev) => ({
        ...prev,
        runtimeMode: runtimeRef.current?.mode ?? null,
        delegate: runtimeRef.current?.delegate ?? null,
      }));
    } catch (error) {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      if (source.kind === "live") video.srcObject = null;
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
    lastVideoTimeRef.current = -1;
    videoTimeBaseRef.current = 0;
    runningRef.current = true;
    if (!countedRef.current) {
      activeSourceCount += 1;
      countedRef.current = true;
    }
    setState((prev) => ({ ...prev, status: "running" }));
    rafRef.current = requestAnimationFrame(() => void loop());
  }, [loop, source.id, source.kind, videoSrc]);

  useEffect(
    () => () => {
      stop();
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    },
    [stop],
  );

  // -------------------------------------------------------------------------
  // Clip handling (video windows)
  // -------------------------------------------------------------------------

  const loadFile = useCallback((file: File) => {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    const url = URL.createObjectURL(file);
    objectUrlRef.current = url;

    extractorRef.current?.reset();
    machineRef.current?.reset();
    lastVideoTimeRef.current = -1;
    videoTimeBaseRef.current = lastTimestampRef.current + 100;

    setVideoSrc(url);
    setClip({ name: file.name, uploaded: true });
    setClipUnavailable(false);
    setState((prev) => ({
      ...prev,
      error: null,
      fallState: "UPRIGHT",
      confidence: 0,
      scores: EMPTY_SCORES,
      persistenceMs: 0,
    }));
  }, []);

  /** Keeps MediaPipe timestamps increasing and drops stale pose history. */
  const handleTimelineJump = useCallback(() => {
    extractorRef.current?.reset();
    machineRef.current?.reset();
    resetFallDedupe();
    lastVideoTimeRef.current = -1;
    videoTimeBaseRef.current = lastTimestampRef.current + 100;
  }, []);

  const handleClipError = useCallback(() => {
    setClipUnavailable(true);
    setClip(null);
  }, []);

  const replay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    handleTimelineJump();
    video.currentTime = 0;
    void video.play();
  }, [handleTimelineJump]);

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
        roomId: room.roomId,
        residentId: room.residentId,
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
  }, [room.residentId, room.roomId]);

  return {
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
  };
}
