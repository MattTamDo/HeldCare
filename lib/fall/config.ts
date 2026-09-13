/**
 * Every tunable number for fall detection lives here so thresholds are never
 * hard-coded across the pipeline. Tune during staged-fall testing.
 */

import { RESIDENT_BY_ROOM } from "../mock/data";

export type MonitoredRoom = {
  roomId: string;
  residentId: string;
  residentName: string;
  floor: number;
};

/**
 * Derived from the incident module's facility directory so a camera tile and
 * its dashboard card always name the same resident. Every monitored room is on
 * floor 2 in this demo.
 */
export const ROOM_DIRECTORY: Record<string, MonitoredRoom> = Object.fromEntries(
  Object.entries(RESIDENT_BY_ROOM).map(([roomId, resident]) => [
    roomId,
    {
      roomId,
      residentId: resident.id,
      residentName: resident.name,
      floor: 2,
    },
  ]),
);

export type CameraSourceKind = "live" | "video";

export type CameraSourceConfig = {
  id: string;
  kind: CameraSourceKind;
  roomId: string;
  /**
   * Clip served from `/public/demo`. Missing files are fine — the tile then
   * asks for an upload. Only used by `video` sources.
   */
  defaultSrc?: string;
};

/**
 * The four windows on `/monitor`: three recorded clips plus the live room
 * camera. Every window runs the same detector and reports through the same
 * `reportFall` contract.
 */
export const CAMERA_WALL: CameraSourceConfig[] = [
  { id: "clip-1", kind: "video", roomId: "201", defaultSrc: "/demo/clip-1.mp4" },
  { id: "clip-2", kind: "video", roomId: "202", defaultSrc: "/demo/clip-2.mp4" },
  { id: "clip-3", kind: "video", roomId: "203", defaultSrc: "/demo/clip-3.mp4" },
  { id: "live", kind: "live", roomId: "204" },
];

export const DEFAULT_ROOM_ID = "204";

export function getMonitoredRoom(roomId: string): MonitoredRoom {
  return (
    ROOM_DIRECTORY[roomId] ?? {
      roomId,
      residentId: `room-${roomId}`,
      residentName: "Unassigned resident",
      floor: 2,
    }
  );
}

export const FALL_CONFIG = {
  runtime: {
    /** Inference rate per source. Deliberately well below the render rate. */
    targetFps: 12,
    /**
     * Per-source rate once more than one window is running, so four windows
     * share the GPU without starving each other.
     */
    sharedTargetFps: 8,
    preferWorker: true,
    workerInitTimeoutMs: 20_000,
    /**
     * Generous because the first few frames pay for GPU graph warm-up. This is
     * only a guard against a wedged worker, not a performance budget.
     */
    inferenceTimeoutMs: 10_000,
  },

  mediapipe: {
    wasmBasePath: "/mediapipe/wasm",
    modelAssetPath: "/models/pose_landmarker_lite.task",
    delegate: "GPU" as "GPU" | "CPU",
    numPoses: 1,
    minPoseDetectionConfidence: 0.5,
    minPosePresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
  },

  pose: {
    /** Landmarks below this visibility are ignored entirely. */
    minLandmarkVisibility: 0.5,
    /** Frames whose mean primary-landmark visibility is below this are skipped. */
    minPoseConfidence: 0.35,
    /** Frames averaged together when smoothing torso angle / aspect ratio. */
    smoothingWindow: 5,
    /** How much pose history to keep. */
    historyMs: 2_500,
    /** Regression window used for hip velocity and torso angle rate. */
    velocityWindowMs: 350,
  },

  torso: {
    /** At or below this the torso counts as vertical (0° = perfectly upright). */
    uprightMaxAngle: 35,
    /** At or above this the torso counts as horizontal (90° = flat). */
    horizontalMinAngle: 60,
    /** Degrees/second that counts as the torso tipping over quickly. */
    fastAngleRateDegPerSec: 70,
  },

  velocity: {
    /** Below this the body is considered settled (used to learn the baseline). */
    quietThreshold: 0.08,
    /** Downward hip velocity that arms the detector. */
    descendingThreshold: 0.35,
    /** Downward hip velocity typical of an uncontrolled fall. */
    fallThreshold: 0.55,
  },

  aspect: {
    /** Bounding box ratio typical of a standing person. */
    standingMaxRatio: 0.6,
    /** Bounding box ratio typical of a body on the floor. */
    horizontalMinRatio: 0.9,
  },

  position: {
    /** Hip Y typical while standing (normalized Y grows downward). */
    uprightHipY: 0.55,
    /** Hip Y that counts as low in the frame. */
    lowHipY: 0.75,
    /** Drop below the learned upright baseline that counts as a fall-height drop. */
    minDropForFall: 0.12,
    /** EMA factor used to learn the upright hip baseline. */
    baselineSmoothing: 0.08,
  },

  stateMachine: {
    /** Time allowed in DESCENDING before giving up and returning to UPRIGHT. */
    descendingWindowMs: 1_500,
    /** Fall posture must hold this long before confirming (spec: 1200–1800ms). */
    persistenceMs: 1_500,
    /** Consecutive upright frames needed to recover / reset. */
    recoveryFramesRequired: 8,
    /** Consecutive upright frames that abort a descent early. */
    descendingRecoveryFrames: 3,
    /** Minimum time after a confirmed fall before the detector can re-arm. */
    resetCooldownMs: 3_000,
    /** Consecutive unusable frames that count as losing the person. */
    lostTrackFrames: 6,
    /** How long the pose may be lost during POSSIBLE_FALL before aborting. */
    lostTrackMs: 1_500,
    /** Independent indicators required to leave DESCENDING. */
    descendingEvidenceRequired: 2,
    /** Valid fall-posture frames required before a fall can be confirmed. */
    minFallPostureFrames: 3,
  },

  confidence: {
    /**
     * Hackathon confidence weighting only — this is not a validated clinical
     * score and must never be presented as one.
     */
    weights: {
      rapidDescent: 0.3,
      horizontalTorso: 0.25,
      aspectRatio: 0.15,
      lowPosition: 0.15,
      persistence: 0.15,
    },
    triggerThreshold: 0.7,
  },

  reporting: {
    /**
     * The incident module lives in this same app, so confirmed falls post to
     * its route by default. Set the env var to "" to run the camera log-only.
     */
    endpoint: process.env.NEXT_PUBLIC_FALL_ENDPOINT ?? "/api/incidents/fall",
    /** Safety net against any duplicate report slipping through. */
    dedupeWindowMs: 4_000,
  },

  overlay: {
    minVisibility: 0.5,
    colors: {
      UPRIGHT: "#34d399",
      DESCENDING: "#fbbf24",
      POSSIBLE_FALL: "#fbbf24",
      CONFIRMED_FALL: "#f43f5e",
    },
  },
} as const;

export const FRAME_INTERVAL_MS = 1000 / FALL_CONFIG.runtime.targetFps;

/** Inference interval for one source, given how many are currently running. */
export function frameIntervalMs(activeSources: number): number {
  const fps =
    activeSources > 1
      ? FALL_CONFIG.runtime.sharedTargetFps
      : FALL_CONFIG.runtime.targetFps;
  return 1000 / fps;
}
