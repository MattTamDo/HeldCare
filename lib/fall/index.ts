/**
 * Public surface of the fall-detection module.
 *
 * Person 2 only needs `FallEvent`, `FallEvidence`, and `reportFall`.
 */
export type {
  BodyCenters,
  FallDetectorSnapshot,
  FallEvent,
  FallEvidence,
  FallFeatures,
  FallSignalScores,
  FallState,
  FallTrigger,
  PoseFrame,
  PoseLandmark,
  PoseRuntimeMode,
} from "./types";

export {
  DEFAULT_ROOM_ID,
  FALL_CONFIG,
  FRAME_INTERVAL_MS,
  ROOM_DIRECTORY,
  getMonitoredRoom,
} from "./config";
export type { MonitoredRoom } from "./config";

export { FallFeatureExtractor, POSE_LANDMARK } from "./fallFeatures";
export { FallStateMachine } from "./fallStateMachine";
export {
  clearFallReportHistory,
  createFallEvent,
  getReportedFalls,
  onFallReported,
  reportFall,
  resetFallDedupe,
} from "./reportFall";
export type { FallReportOutcome, ReportedFall } from "./reportFall";
export { createPoseDetector } from "./poseClient";
export type { PoseDetector, PoseSample } from "./poseClient";
export { clearCanvas, drawPoseSkeleton, skeletonColor } from "./drawPose";
