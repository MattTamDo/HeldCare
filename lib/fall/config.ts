/**
 * Every tunable number for fall detection lives here so thresholds are never
 * hard-coded across the pipeline. Tune during staged-fall testing.
 */

export type MonitoredRoom = {
  roomId: string;
  residentId: string;
  residentName: string;
  floor: number;
};

/**
 * Minimal local directory so `/camera/204` can render a name. The authoritative
 * facility directory belongs to Person 2's incident module.
 */
export const ROOM_DIRECTORY: Record<string, MonitoredRoom> = {
  "204": {
    roomId: "204",
    residentId: "margaret",
    residentName: "Margaret Davis",
    floor: 2,
  },
};

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
    /** Inference rate. Deliberately well below the render frame rate. */
    targetFps: 12,
    preferWorker: true,
    workerInitTimeoutMs: 20_000,
    inferenceTimeoutMs: 2_500,
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
     * Person 2 sets this to `/api/incidents/fall`. Empty means log-only.
     */
    endpoint: process.env.NEXT_PUBLIC_FALL_ENDPOINT ?? "",
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
