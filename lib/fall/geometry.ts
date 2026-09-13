import type { Point, PoseLandmark } from "./types";

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

/** Maps `value` onto 0–1 across the `[low, high]` range. */
export function normalizeRange(
  value: number,
  low: number,
  high: number,
): number {
  if (high === low) return value >= high ? 1 : 0;
  return clamp01((value - low) / (high - low));
}

export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  let total = 0;
  for (const value of values) total += value;
  return total / values.length;
}

export function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

export function isVisible(
  landmark: PoseLandmark | undefined,
  minVisibility: number,
): landmark is PoseLandmark {
  return landmark !== undefined && landmark.visibility >= minVisibility;
}

/**
 * Center of a left/right landmark pair. Falls back to whichever side is visible
 * so a partially occluded body (common once someone is on the floor) still
 * produces usable features.
 */
export function centerOfPair(
  left: PoseLandmark | undefined,
  right: PoseLandmark | undefined,
  minVisibility: number,
): Point | null {
  const leftOk = isVisible(left, minVisibility);
  const rightOk = isVisible(right, minVisibility);
  if (leftOk && rightOk) return midpoint(left, right);
  if (leftOk) return { x: left.x, y: left.y };
  if (rightOk) return { x: right.x, y: right.y };
  return null;
}

/**
 * Angle in degrees between a segment and the vertical axis.
 * 0° = vertical (standing), 90° = horizontal (lying down).
 *
 * `frameAspect` (videoWidth / videoHeight) converts normalized X into the same
 * physical scale as Y, otherwise wide frames exaggerate horizontal distances.
 */
export function angleFromVertical(
  from: Point,
  to: Point,
  frameAspect = 1,
): number {
  const dx = Math.abs(to.x - from.x) * frameAspect;
  const dy = Math.abs(to.y - from.y);
  if (dx === 0 && dy === 0) return 0;
  return (Math.atan2(dx, dy) * 180) / Math.PI;
}

export type BoundingBox = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  count: number;
};

export function boundingBox(
  landmarks: PoseLandmark[],
  minVisibility: number,
): BoundingBox | null {
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  let count = 0;

  for (const landmark of landmarks) {
    if (!isVisible(landmark, minVisibility)) continue;
    minX = Math.min(minX, landmark.x);
    maxX = Math.max(maxX, landmark.x);
    minY = Math.min(minY, landmark.y);
    maxY = Math.max(maxY, landmark.y);
    count += 1;
  }

  if (count === 0) return null;
  return { minX, maxX, minY, maxY, count };
}

/** Bounding-box width / height, corrected for the frame's aspect ratio. */
export function aspectRatioOf(box: BoundingBox, frameAspect = 1): number {
  const width = (box.maxX - box.minX) * frameAspect;
  const height = box.maxY - box.minY;
  if (height <= 1e-6) return 999;
  return width / height;
}

/**
 * Least-squares slope of `value` over time, expressed per second. Regression
 * over a short window is far steadier than differencing two frames.
 */
export function slopePerSecond(
  samples: { t: number; value: number }[],
): number {
  const n = samples.length;
  if (n < 2) return 0;

  const t0 = samples[0].t;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;

  for (const sample of samples) {
    const x = sample.t - t0;
    sumX += x;
    sumY += sample.value;
    sumXY += x * sample.value;
    sumXX += x * x;
  }

  const denominator = n * sumXX - sumX * sumX;
  if (Math.abs(denominator) < 1e-9) return 0;

  // Slope is per millisecond; scale to per second.
  return ((n * sumXY - sumX * sumY) / denominator) * 1000;
}

export function round(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
