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
  CAMERA_WALL,
  DEFAULT_ROOM_ID,
  FALL_CONFIG,
  FRAME_INTERVAL_MS,
  ROOM_DIRECTORY,
  frameIntervalMs,
  getMonitoredRoom,
} from "./config";
export type {
  CameraSourceConfig,
  CameraSourceKind,
  MonitoredRoom,
} from "./config";

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
export { acquirePoseRuntime, releasePoseRuntime } from "./poseClient";
export type { PoseRuntime, PoseSample } from "./poseClient";
export { clearCanvas, drawPoseSkeleton, skeletonColor } from "./drawPose";
