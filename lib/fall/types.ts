/**
 * Shared types for the CareFall fall-detection module.
 *
 * `FallEvent` / `FallEvidence` are the team-wide contract consumed by Person 2.
 * Everything else is internal to this module.
 */

// ---------------------------------------------------------------------------
// Team contract — do not change without coordinating with Person 2
// ---------------------------------------------------------------------------

export type FallEvidence = {
  torsoAngle?: number;
  hipVelocity?: number;
  aspectRatio?: number;
  persistenceMs?: number;
};

export type FallEvent = {
  type: "FALL_DETECTED";
  roomId: string;
  residentId: string;
  timestamp: number;
  confidence: number;
  evidence?: FallEvidence;
};

/** How a confirmed fall reached `reportFall`. */
export type FallTrigger = "detector" | "manual";

// ---------------------------------------------------------------------------
// Pose data
// ---------------------------------------------------------------------------

export type Point = { x: number; y: number };

/** Matches MediaPipe's `NormalizedLandmark`. */
export type PoseLandmark = {
  x: number;
  y: number;
  z: number;
  visibility: number;
};

/** One pose inference result fed into the detection pipeline. */
export type PoseFrame = {
  /** Monotonic timestamp in ms (`performance.now()`). */
  t: number;
  landmarks: PoseLandmark[];
  /** `videoWidth / videoHeight`, used to undo normalized-coordinate distortion. */
  frameAspect: number;
};

export type BodyCenters = {
  shoulderCenter: Point;
  hipCenter: Point;
  kneeCenter: Point;
  ankleCenter: Point;
};

// ---------------------------------------------------------------------------
// Features
// ---------------------------------------------------------------------------

export type FallFeatures = {
  /** Monotonic timestamp of the frame these features describe. */
  t: number;
  /** Mean visibility of the primary landmarks, 0–1. */
  poseConfidence: number;
  /** Degrees between shoulderCenter→hipCenter and vertical. 0 = upright, 90 = horizontal. */
  torsoAngle: number;
  /** Degrees/second the torso is tipping over. */
  torsoAngleRate: number;
  /** Normalized units/second. Positive = moving down the frame. */
  hipVelocity: number;
  /** Bounding-box width / height, corrected for frame aspect. */
  aspectRatio: number;
  hipY: number;
  shoulderY: number;
  noseY: number;
  /** `hipY` minus the learned upright baseline. Positive = lower than usual. */
  verticalDrop: number;
  centers: BodyCenters;
  isHorizontalPosture: boolean;
  isLowInFrame: boolean;
  isFallPosture: boolean;
  isUprightPosture: boolean;
};

// ---------------------------------------------------------------------------
// State machine
// ---------------------------------------------------------------------------

export type FallState =
  | "UPRIGHT"
  | "DESCENDING"
  | "POSSIBLE_FALL"
  | "CONFIRMED_FALL";

export type FallSignalScores = {
  rapidDescent: number;
  horizontalTorso: number;
  aspectRatio: number;
  lowPosition: number;
  persistence: number;
};

export type FallDetectorSnapshot = {
  state: FallState;
  previousState: FallState;
  stateChanged: boolean;
  /** Weighted 0–1 hackathon confidence score. Not a medical measure. */
  confidence: number;
  scores: FallSignalScores;
  persistenceMs: number;
  peakHipVelocity: number;
  evidenceCount: number;
  features: FallFeatures | null;
  /** True on exactly the frame a new fall must be reported. */
  shouldEmit: boolean;
  evidence: FallEvidence | null;
};

// ---------------------------------------------------------------------------
// Pose worker protocol
// ---------------------------------------------------------------------------

export type PoseRuntimeMode = "worker" | "main";

export type PoseLandmarkerSettings = {
  wasmBasePath: string;
  modelAssetPath: string;
  delegate: "GPU" | "CPU";
  numPoses: number;
  minPoseDetectionConfidence: number;
  minPosePresenceConfidence: number;
  minTrackingConfidence: number;
};

/**
 * One worker serves every camera window, but each window gets its own
 * landmarker so MediaPipe's frame-to-frame tracking is not confused by
 * interleaved streams.
 */
export type PoseWorkerRequest =
  | ({ type: "init"; sourceId: string } & PoseLandmarkerSettings)
  | { type: "open"; sourceId: string }
  | {
      type: "detect";
      id: number;
      sourceId: string;
      bitmap: ImageBitmap;
      t: number;
    }
  | { type: "closeSource"; sourceId: string }
  | { type: "close" };

export type PoseWorkerResponse =
  | { type: "ready"; delegate: "GPU" | "CPU" }
  | { type: "opened"; sourceId: string }
  | { type: "result"; id: number; t: number; landmarks: PoseLandmark[] | null }
  | { type: "error"; id?: number; sourceId?: string; message: string };
