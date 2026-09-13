import { FALL_CONFIG } from "./config";
import {
  aspectRatioOf,
  angleFromVertical,
  boundingBox,
  centerOfPair,
  mean,
  slopePerSecond,
} from "./geometry";
import type { BodyCenters, FallFeatures, PoseFrame, Point } from "./types";

/** BlazePose (33 landmark) indices used by this module. */
export const POSE_LANDMARK = {
  NOSE: 0,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
} as const;

const PRIMARY_LANDMARK_INDICES = Object.values(POSE_LANDMARK);

type Sample = {
  t: number;
  hipY: number;
  shoulderY: number;
  noseY: number;
  torsoAngle: number;
  aspectRatio: number;
};

/**
 * Turns raw pose frames into the temporal features the state machine reasons
 * about. Holds the short history needed for velocity and smoothing, plus the
 * learned "upright" hip height used to measure how far the body dropped.
 */
export class FallFeatureExtractor {
  private samples: Sample[] = [];
  private baselineHipY: number | null = null;

  reset(): void {
    this.samples = [];
    this.baselineHipY = null;
  }

  get uprightBaselineHipY(): number | null {
    return this.baselineHipY;
  }

  /** Returns `null` when the frame is too poor to trust. */
  push(frame: PoseFrame): FallFeatures | null {
    const { pose, torso, aspect, position } = FALL_CONFIG;
    const landmarks = frame.landmarks;
    if (landmarks.length === 0) return null;

    const poseConfidence = mean(
      PRIMARY_LANDMARK_INDICES.map(
        (index) => landmarks[index]?.visibility ?? 0,
      ),
    );
    if (poseConfidence < pose.minPoseConfidence) return null;

    const minVisibility = pose.minLandmarkVisibility;
    const shoulderCenter = centerOfPair(
      landmarks[POSE_LANDMARK.LEFT_SHOULDER],
      landmarks[POSE_LANDMARK.RIGHT_SHOULDER],
      minVisibility,
    );
    const hipCenter = centerOfPair(
      landmarks[POSE_LANDMARK.LEFT_HIP],
      landmarks[POSE_LANDMARK.RIGHT_HIP],
      minVisibility,
    );

    // Torso landmarks drive every feature; without them the frame is unusable.
    if (!shoulderCenter || !hipCenter) return null;

    const kneeCenter =
      centerOfPair(
        landmarks[POSE_LANDMARK.LEFT_KNEE],
        landmarks[POSE_LANDMARK.RIGHT_KNEE],
        minVisibility,
      ) ?? hipCenter;
    const ankleCenter =
      centerOfPair(
        landmarks[POSE_LANDMARK.LEFT_ANKLE],
        landmarks[POSE_LANDMARK.RIGHT_ANKLE],
        minVisibility,
      ) ?? kneeCenter;

    const centers: BodyCenters = {
      shoulderCenter,
      hipCenter,
      kneeCenter,
      ankleCenter,
    };

    const rawTorsoAngle = angleFromVertical(
      shoulderCenter,
      hipCenter,
      frame.frameAspect,
    );

    const box = boundingBox(landmarks, minVisibility);
    const rawAspectRatio = box
      ? aspectRatioOf(box, frame.frameAspect)
      : aspectRatioOf(
          {
            minX: Math.min(shoulderCenter.x, hipCenter.x),
            maxX: Math.max(shoulderCenter.x, hipCenter.x),
            minY: Math.min(shoulderCenter.y, hipCenter.y),
            maxY: Math.max(shoulderCenter.y, hipCenter.y),
            count: 2,
          },
          frame.frameAspect,
        );

    const noseLandmark = landmarks[POSE_LANDMARK.NOSE];
    const noseY = noseLandmark ? noseLandmark.y : shoulderCenter.y;

    this.samples.push({
      t: frame.t,
      hipY: hipCenter.y,
      shoulderY: shoulderCenter.y,
      noseY,
      torsoAngle: rawTorsoAngle,
      aspectRatio: rawAspectRatio,
    });
    this.trimHistory(frame.t);

    const smoothWindow = this.samples.slice(-pose.smoothingWindow);
    const torsoAngle = mean(smoothWindow.map((s) => s.torsoAngle));
    const aspectRatio = mean(smoothWindow.map((s) => s.aspectRatio));
    const hipY = mean(smoothWindow.map((s) => s.hipY));
    const shoulderY = mean(smoothWindow.map((s) => s.shoulderY));
    const smoothedNoseY = mean(smoothWindow.map((s) => s.noseY));

    const velocityWindow = this.samples.filter(
      (s) => frame.t - s.t <= pose.velocityWindowMs,
    );
    const hipVelocity = slopePerSecond(
      velocityWindow.map((s) => ({ t: s.t, value: s.hipY })),
    );
    const torsoAngleRate = slopePerSecond(
      velocityWindow.map((s) => ({ t: s.t, value: s.torsoAngle })),
    );

    this.updateBaseline(hipY, torsoAngle, hipVelocity);
    const verticalDrop =
      this.baselineHipY === null ? 0 : hipY - this.baselineHipY;

    const isHorizontalPosture =
      torsoAngle >= torso.horizontalMinAngle ||
      aspectRatio >= aspect.horizontalMinRatio;
    const isLowInFrame =
      hipY >= position.lowHipY || verticalDrop >= position.minDropForFall;

    return {
      t: frame.t,
      poseConfidence,
      torsoAngle,
      torsoAngleRate,
      hipVelocity,
      aspectRatio,
      hipY,
      shoulderY,
      noseY: smoothedNoseY,
      verticalDrop,
      centers,
      isHorizontalPosture,
      isLowInFrame,
      // Both conditions are required: this is what keeps bending over (torso
      // horizontal but hips still high) from reading as a fall.
      isFallPosture: isHorizontalPosture && isLowInFrame,
      isUprightPosture: torsoAngle <= torso.uprightMaxAngle && !isLowInFrame,
    };
  }

  private trimHistory(now: number): void {
    const cutoff = now - FALL_CONFIG.pose.historyMs;
    while (this.samples.length > 0 && this.samples[0].t < cutoff) {
      this.samples.shift();
    }
  }

  private updateBaseline(
    hipY: number,
    torsoAngle: number,
    hipVelocity: number,
  ): void {
    if (this.baselineHipY === null) {
      this.baselineHipY = hipY;
      return;
    }

    const settledAndUpright =
      torsoAngle <= FALL_CONFIG.torso.uprightMaxAngle &&
      Math.abs(hipVelocity) <= FALL_CONFIG.velocity.quietThreshold;
    if (!settledAndUpright) return;

    const alpha = FALL_CONFIG.position.baselineSmoothing;
    this.baselineHipY += (hipY - this.baselineHipY) * alpha;
  }
}

export function centersToArray(centers: BodyCenters): Point[] {
  return [
    centers.shoulderCenter,
    centers.hipCenter,
    centers.kneeCenter,
    centers.ankleCenter,
  ];
}
