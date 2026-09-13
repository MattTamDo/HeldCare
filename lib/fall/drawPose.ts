import { FALL_CONFIG } from "./config";
import { POSE_LANDMARK } from "./fallFeatures";
import { isVisible } from "./geometry";
import type { BodyCenters, FallState, PoseLandmark } from "./types";

/** BlazePose connections, trimmed to the body (face detail adds visual noise). */
export const SKELETON_CONNECTIONS: readonly [number, number][] = [
  // Torso
  [11, 12],
  [11, 23],
  [12, 24],
  [23, 24],
  // Arms
  [11, 13],
  [13, 15],
  [12, 14],
  [14, 16],
  // Legs
  [23, 25],
  [25, 27],
  [27, 31],
  [24, 26],
  [26, 28],
  [28, 32],
];

const CENTER_CHAIN: (keyof BodyCenters)[] = [
  "shoulderCenter",
  "hipCenter",
  "kneeCenter",
  "ankleCenter",
];

export function skeletonColor(state: FallState): string {
  return FALL_CONFIG.overlay.colors[state];
}

export function clearCanvas(canvas: HTMLCanvasElement): void {
  canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
}

export function drawPoseSkeleton(
  canvas: HTMLCanvasElement,
  landmarks: PoseLandmark[],
  options: { state: FallState; centers?: BodyCenters | null },
): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const { width, height } = canvas;
  const color = skeletonColor(options.state);
  const minVisibility = FALL_CONFIG.overlay.minVisibility;

  ctx.clearRect(0, 0, width, height);
  ctx.lineCap = "round";

  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(2, width / 260);
  ctx.shadowColor = color;
  ctx.shadowBlur = 8;

  for (const [from, to] of SKELETON_CONNECTIONS) {
    const a = landmarks[from];
    const b = landmarks[to];
    if (!isVisible(a, minVisibility) || !isVisible(b, minVisibility)) continue;
    ctx.beginPath();
    ctx.moveTo(a.x * width, a.y * height);
    ctx.lineTo(b.x * width, b.y * height);
    ctx.stroke();
  }

  ctx.shadowBlur = 0;
  ctx.fillStyle = color;
  const jointRadius = Math.max(2.5, width / 320);
  for (const index of Object.values(POSE_LANDMARK)) {
    const landmark = landmarks[index];
    if (!isVisible(landmark, minVisibility)) continue;
    ctx.beginPath();
    ctx.arc(
      landmark.x * width,
      landmark.y * height,
      jointRadius,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }

  if (options.centers) drawCenterAxis(ctx, options.centers, width, height);
}

/** The shoulder→hip→knee→ankle axis the features are derived from. */
function drawCenterAxis(
  ctx: CanvasRenderingContext2D,
  centers: BodyCenters,
  width: number,
  height: number,
): void {
  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.55)";
  ctx.lineWidth = Math.max(1, width / 700);
  ctx.setLineDash([5, 5]);
  ctx.beginPath();
  CENTER_CHAIN.forEach((key, index) => {
    const point = centers[key];
    const x = point.x * width;
    const y = point.y * height;
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
  ctx.restore();
}
