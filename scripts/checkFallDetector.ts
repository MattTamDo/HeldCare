/**
 * Synthetic check for the fall detector.
 *
 * Drives the real `FallFeatureExtractor` + `FallStateMachine` with generated
 * pose sequences so the eight scenarios in the module spec can be verified
 * without staging a fall in front of a webcam. Run with `npm run check:fall`.
 */

import { FALL_CONFIG, FRAME_INTERVAL_MS } from "../lib/fall/config";
import { FallFeatureExtractor, POSE_LANDMARK } from "../lib/fall/fallFeatures";
import { FallStateMachine } from "../lib/fall/fallStateMachine";
import type { FallState, PoseLandmark } from "../lib/fall/types";

const FRAME_ASPECT = 16 / 9;

// Body proportions in "frame height" units.
const TORSO_LENGTH = 0.28;
const NECK_LENGTH = 0.12;
const THIGH_LENGTH = 0.24;
const SHIN_LENGTH = 0.24;
const SHOULDER_HALF_WIDTH = 0.09;
const HIP_HALF_WIDTH = 0.06;

type Posture = {
  /** Normalized hip height; larger is lower in the frame. */
  hipY: number;
  /** Degrees from vertical: 0 upright, 90 horizontal. */
  torsoAngle: number;
  /** Degrees the legs swing away from straight down. */
  legAngle: number;
  hipX: number;
};

const STANDING: Posture = { hipY: 0.5, torsoAngle: 2, legAngle: 0, hipX: 0 };
const COLLAPSED: Posture = {
  hipY: 0.86,
  torsoAngle: 86,
  legAngle: 80,
  hipX: 0,
};

function degToRad(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function lerp(a: number, b: number, k: number): number {
  return a + (b - a) * k;
}

function lerpPosture(a: Posture, b: Posture, k: number): Posture {
  return {
    hipY: lerp(a.hipY, b.hipY, k),
    torsoAngle: lerp(a.torsoAngle, b.torsoAngle, k),
    legAngle: lerp(a.legAngle, b.legAngle, k),
    hipX: lerp(a.hipX, b.hipX, k),
  };
}

function landmark(xPhysical: number, y: number): PoseLandmark {
  return {
    x: 0.5 + xPhysical / FRAME_ASPECT,
    y,
    z: 0,
    visibility: 0.95,
  };
}

/** Builds a 33-landmark pose; unmodelled joints stay invisible. */
function buildLandmarks(posture: Posture): PoseLandmark[] {
  const landmarks: PoseLandmark[] = Array.from({ length: 33 }, () => ({
    x: 0,
    y: 0,
    z: 0,
    visibility: 0,
  }));

  const torso = degToRad(posture.torsoAngle);
  const legs = degToRad(posture.legAngle);

  const hipX = posture.hipX;
  const hipY = posture.hipY;

  const shoulderX = hipX + TORSO_LENGTH * Math.sin(torso);
  const shoulderY = hipY - TORSO_LENGTH * Math.cos(torso);
  const noseX = shoulderX + NECK_LENGTH * Math.sin(torso);
  const noseY = shoulderY - NECK_LENGTH * Math.cos(torso);

  const kneeX = hipX + THIGH_LENGTH * Math.sin(legs);
  const kneeY = hipY + THIGH_LENGTH * Math.cos(legs);
  const ankleX = kneeX + SHIN_LENGTH * Math.sin(legs);
  const ankleY = kneeY + SHIN_LENGTH * Math.cos(legs);

  // Shoulder/hip pairs spread perpendicular to the torso, so a horizontal
  // torso gives the body vertical thickness instead of collapsing to a line.
  const perpX = Math.cos(torso);
  const perpY = Math.sin(torso);

  landmarks[POSE_LANDMARK.NOSE] = landmark(noseX, noseY);
  landmarks[POSE_LANDMARK.LEFT_SHOULDER] = landmark(
    shoulderX + SHOULDER_HALF_WIDTH * perpX,
    shoulderY + SHOULDER_HALF_WIDTH * perpY,
  );
  landmarks[POSE_LANDMARK.RIGHT_SHOULDER] = landmark(
    shoulderX - SHOULDER_HALF_WIDTH * perpX,
    shoulderY - SHOULDER_HALF_WIDTH * perpY,
  );
  landmarks[POSE_LANDMARK.LEFT_HIP] = landmark(
    hipX + HIP_HALF_WIDTH * perpX,
    hipY + HIP_HALF_WIDTH * perpY,
  );
  landmarks[POSE_LANDMARK.RIGHT_HIP] = landmark(
    hipX - HIP_HALF_WIDTH * perpX,
    hipY - HIP_HALF_WIDTH * perpY,
  );
  landmarks[POSE_LANDMARK.LEFT_KNEE] = landmark(kneeX, kneeY);
  landmarks[POSE_LANDMARK.RIGHT_KNEE] = landmark(kneeX, kneeY);
  landmarks[POSE_LANDMARK.LEFT_ANKLE] = landmark(ankleX, ankleY);
  landmarks[POSE_LANDMARK.RIGHT_ANKLE] = landmark(ankleX, ankleY);

  return landmarks;
}

type Segment = { ms: number; from: Posture; to: Posture };

type Scenario = {
  name: string;
  segments: Segment[];
  /** Optional per-frame wobble, e.g. gait. */
  modulate?: (posture: Posture, t: number) => Posture;
  expect: {
    events: number;
    finalState?: FallState;
    reachedStates?: FallState[];
  };
};

function hold(ms: number, posture: Posture): Segment {
  return { ms, from: posture, to: posture };
}

function move(ms: number, from: Posture, to: Posture): Segment {
  return { ms, from, to };
}

function postureAt(segments: Segment[], t: number): Posture {
  let elapsed = 0;
  for (const segment of segments) {
    if (t < elapsed + segment.ms) {
      const k = segment.ms === 0 ? 1 : (t - elapsed) / segment.ms;
      return lerpPosture(segment.from, segment.to, k);
    }
    elapsed += segment.ms;
  }
  return segments[segments.length - 1].to;
}

const SCENARIOS: Scenario[] = [
  {
    name: "1. walks normally",
    segments: [hold(6000, STANDING)],
    modulate: (posture, t) => ({
      ...posture,
      hipY: posture.hipY + 0.012 * Math.sin((2 * Math.PI * t) / 1000),
      torsoAngle: posture.torsoAngle + 3 * Math.sin((2 * Math.PI * t) / 900),
      legAngle: 12 * Math.sin((2 * Math.PI * t) / 1000),
    }),
    expect: { events: 0, finalState: "UPRIGHT" },
  },
  {
    name: "2. stands still",
    segments: [hold(5000, STANDING)],
    expect: { events: 0, finalState: "UPRIGHT" },
  },
  {
    name: "3. bends down to pick something up",
    segments: [
      hold(2000, STANDING),
      move(700, STANDING, { ...STANDING, torsoAngle: 80, hipY: 0.54 }),
      hold(1500, { ...STANDING, torsoAngle: 80, hipY: 0.54 }),
      move(700, { ...STANDING, torsoAngle: 80, hipY: 0.54 }, STANDING),
      hold(1500, STANDING),
    ],
    expect: { events: 0, finalState: "UPRIGHT" },
  },
  {
    name: "4. sits down in a chair",
    segments: [
      hold(2000, STANDING),
      move(1200, STANDING, { hipY: 0.64, torsoAngle: 12, legAngle: 70, hipX: 0 }),
      hold(4000, { hipY: 0.64, torsoAngle: 12, legAngle: 70, hipX: 0 }),
    ],
    expect: { events: 0, finalState: "UPRIGHT" },
  },
  {
    name: "5. staged fall, stays down",
    segments: [
      hold(2000, STANDING),
      move(400, STANDING, COLLAPSED),
      hold(4000, COLLAPSED),
    ],
    expect: { events: 1, finalState: "CONFIRMED_FALL" },
  },
  {
    name: "6. falls then recovers quickly",
    segments: [
      hold(2000, STANDING),
      move(400, STANDING, COLLAPSED),
      hold(600, COLLAPSED),
      move(700, COLLAPSED, STANDING),
      hold(2500, STANDING),
    ],
    expect: {
      events: 0,
      finalState: "UPRIGHT",
      reachedStates: ["DESCENDING", "POSSIBLE_FALL"],
    },
  },
  {
    name: "7. remains on the floor",
    segments: [
      hold(2000, STANDING),
      move(400, STANDING, COLLAPSED),
      hold(12000, COLLAPSED),
    ],
    expect: { events: 1, finalState: "CONFIRMED_FALL" },
  },
  {
    name: "8. stands up after the fall",
    segments: [
      hold(2000, STANDING),
      move(400, STANDING, COLLAPSED),
      hold(5000, COLLAPSED),
      move(900, COLLAPSED, STANDING),
      hold(3000, STANDING),
    ],
    expect: { events: 1, finalState: "UPRIGHT" },
  },
];

type Run = {
  events: number;
  finalState: FallState;
  visited: Set<FallState>;
  peakConfidence: number;
  confirmations: { atMs: number; confidence: number }[];
};

function run(scenario: Scenario): Run {
  const extractor = new FallFeatureExtractor();
  const machine = new FallStateMachine();
  const total = scenario.segments.reduce((sum, s) => sum + s.ms, 0);

  const result: Run = {
    events: 0,
    finalState: "UPRIGHT",
    visited: new Set<FallState>(),
    peakConfidence: 0,
    confirmations: [],
  };

  for (let t = 0; t <= total; t += FRAME_INTERVAL_MS) {
    let posture = postureAt(scenario.segments, t);
    if (scenario.modulate) posture = scenario.modulate(posture, t);

    const features = extractor.push({
      t,
      landmarks: buildLandmarks(posture),
      frameAspect: FRAME_ASPECT,
    });
    const snapshot = machine.update(features, t);

    result.visited.add(snapshot.state);
    result.peakConfidence = Math.max(result.peakConfidence, snapshot.confidence);
    if (snapshot.shouldEmit) {
      result.events += 1;
      result.confirmations.push({
        atMs: Math.round(t),
        confidence: Number(snapshot.confidence.toFixed(2)),
      });
    }
    result.finalState = snapshot.state;
  }

  return result;
}

function main(): void {
  console.log(
    `Fall detector check · ${FALL_CONFIG.runtime.targetFps} fps · trigger ${FALL_CONFIG.confidence.triggerThreshold} · persistence ${FALL_CONFIG.stateMachine.persistenceMs}ms\n`,
  );

  let failures = 0;

  for (const scenario of SCENARIOS) {
    const result = run(scenario);
    const problems: string[] = [];

    if (result.events !== scenario.expect.events) {
      problems.push(
        `expected ${scenario.expect.events} event(s), got ${result.events}`,
      );
    }
    if (
      scenario.expect.finalState &&
      result.finalState !== scenario.expect.finalState
    ) {
      problems.push(
        `expected final state ${scenario.expect.finalState}, got ${result.finalState}`,
      );
    }
    for (const state of scenario.expect.reachedStates ?? []) {
      if (!result.visited.has(state)) {
        problems.push(`never reached ${state}`);
      }
    }

    const status = problems.length === 0 ? "PASS" : "FAIL";
    if (problems.length > 0) failures += 1;

    console.log(`${status}  ${scenario.name}`);
    console.log(
      `      events=${result.events} final=${result.finalState} peakScore=${Math.round(
        result.peakConfidence * 100,
      )}% states=${[...result.visited].join(",")}`,
    );
    if (result.confirmations.length > 0) {
      console.log(
        `      confirmed: ${result.confirmations
          .map((c) => `${c.atMs}ms @ ${Math.round(c.confidence * 100)}%`)
          .join(", ")}`,
      );
    }
    for (const problem of problems) console.log(`      → ${problem}`);
  }

  console.log(
    `\n${SCENARIOS.length - failures}/${SCENARIOS.length} scenarios passed`,
  );
  if (failures > 0) process.exit(1);
}

main();
