import { FALL_CONFIG } from "./config";
import { normalizeRange, round } from "./geometry";
import type {
  FallDetectorSnapshot,
  FallEvidence,
  FallFeatures,
  FallSignalScores,
  FallState,
} from "./types";

const EMPTY_SCORES: FallSignalScores = {
  rapidDescent: 0,
  horizontalTorso: 0,
  aspectRatio: 0,
  lowPosition: 0,
  persistence: 0,
};

/**
 * Temporal fall detector.
 *
 * UPRIGHT → DESCENDING → POSSIBLE_FALL → CONFIRMED_FALL, with recovery paths
 * back to UPRIGHT from DESCENDING and POSSIBLE_FALL. A horizontal body alone
 * never confirms a fall: the body must also have moved down quickly and stayed
 * down for the persistence window.
 */
export class FallStateMachine {
  private state: FallState = "UPRIGHT";
  private descendingSince = 0;
  private possibleFallSince = 0;
  private confirmedAt = 0;
  private confirmedPersistenceMs = 0;
  private peakHipVelocity = 0;
  private recoveryFrames = 0;
  private fallPostureFrames = 0;
  private invalidFrames = 0;
  private lastValidT = 0;
  private emitted = false;
  private confidence = 0;
  private scores: FallSignalScores = EMPTY_SCORES;
  private evidenceCount = 0;
  private evidence: FallEvidence | null = null;

  get currentState(): FallState {
    return this.state;
  }

  /** Clears all history and re-arms the detector. */
  reset(): void {
    this.state = "UPRIGHT";
    this.descendingSince = 0;
    this.possibleFallSince = 0;
    this.confirmedAt = 0;
    this.confirmedPersistenceMs = 0;
    this.peakHipVelocity = 0;
    this.recoveryFrames = 0;
    this.fallPostureFrames = 0;
    this.invalidFrames = 0;
    this.emitted = false;
    this.confidence = 0;
    this.scores = EMPTY_SCORES;
    this.evidenceCount = 0;
    this.evidence = null;
  }

  update(features: FallFeatures | null, t: number): FallDetectorSnapshot {
    const previousState = this.state;
    const sm = FALL_CONFIG.stateMachine;

    if (!features) {
      this.invalidFrames += 1;
      // Losing the person mid-descent means we never saw the outcome, so the
      // detector stands down rather than guessing.
      if (
        this.state === "DESCENDING" &&
        this.invalidFrames >= sm.lostTrackFrames
      ) {
        this.standDown();
      } else if (
        this.state === "POSSIBLE_FALL" &&
        t - this.lastValidT > sm.lostTrackMs
      ) {
        this.standDown();
      }
      return this.buildSnapshot(previousState, null, t, false);
    }

    this.invalidFrames = 0;
    this.lastValidT = t;

    // Peak downward velocity of the current episode; reset while upright so the
    // HUD score tracks live movement instead of a stale spike.
    this.peakHipVelocity =
      this.state === "UPRIGHT"
        ? Math.max(0, features.hipVelocity)
        : Math.max(this.peakHipVelocity, features.hipVelocity);

    if (features.isFallPosture) this.fallPostureFrames += 1;

    this.evidenceCount = this.countEvidence(features);
    this.scores = this.computeScores(features, this.persistenceElapsed(t));
    this.confidence = this.weightedConfidence(this.scores);

    let shouldEmit = false;

    switch (this.state) {
      case "UPRIGHT": {
        const rapidDescent =
          features.hipVelocity >= FALL_CONFIG.velocity.descendingThreshold;
        const rapidTorsoChange =
          features.torsoAngleRate >= FALL_CONFIG.torso.fastAngleRateDegPerSec;
        if (rapidDescent || rapidTorsoChange) {
          this.state = "DESCENDING";
          this.descendingSince = t;
          this.recoveryFrames = 0;
          this.fallPostureFrames = 0;
        }
        break;
      }

      case "DESCENDING": {
        if (
          features.isFallPosture &&
          this.evidenceCount >= sm.descendingEvidenceRequired
        ) {
          this.state = "POSSIBLE_FALL";
          this.possibleFallSince = t;
          this.recoveryFrames = 0;
          break;
        }

        this.recoveryFrames = features.isUprightPosture
          ? this.recoveryFrames + 1
          : 0;

        const recovered = this.recoveryFrames >= sm.descendingRecoveryFrames;
        const ranOutOfTime = t - this.descendingSince > sm.descendingWindowMs;
        if (recovered || ranOutOfTime) this.standDown();
        break;
      }

      case "POSSIBLE_FALL": {
        this.recoveryFrames = features.isUprightPosture
          ? this.recoveryFrames + 1
          : 0;
        if (this.recoveryFrames >= sm.recoveryFramesRequired) {
          this.standDown();
          break;
        }

        const persistenceMs = t - this.possibleFallSince;
        const readyToConfirm =
          persistenceMs >= sm.persistenceMs &&
          this.fallPostureFrames >= sm.minFallPostureFrames &&
          this.confidence >= FALL_CONFIG.confidence.triggerThreshold;

        if (readyToConfirm && !this.emitted) {
          this.state = "CONFIRMED_FALL";
          this.confirmedAt = t;
          this.confirmedPersistenceMs = persistenceMs;
          this.recoveryFrames = 0;
          this.emitted = true;
          shouldEmit = true;
          this.evidence = {
            torsoAngle: round(features.torsoAngle, 0),
            hipVelocity: round(this.peakHipVelocity, 2),
            aspectRatio: round(features.aspectRatio, 2),
            persistenceMs: Math.round(persistenceMs),
          };
        }
        break;
      }

      case "CONFIRMED_FALL": {
        // One event per fall: stay here, silently, until the resident is back
        // upright for a sustained stretch.
        this.recoveryFrames = features.isUprightPosture
          ? this.recoveryFrames + 1
          : 0;
        const cooledDown = t - this.confirmedAt >= sm.resetCooldownMs;
        if (cooledDown && this.recoveryFrames >= sm.recoveryFramesRequired) {
          this.standDown();
        }
        break;
      }
    }

    return this.buildSnapshot(previousState, features, t, shouldEmit);
  }

  /**
   * Used by the manual `F` fallback so the UI reflects a confirmed fall. The
   * caller still reports the event through `reportFall`.
   */
  forceConfirm(t: number): FallDetectorSnapshot {
    const previousState = this.state;
    this.state = "CONFIRMED_FALL";
    this.confirmedAt = t;
    this.confirmedPersistenceMs = FALL_CONFIG.stateMachine.persistenceMs;
    this.recoveryFrames = 0;
    this.emitted = true;
    this.confidence = 1;
    return this.buildSnapshot(previousState, null, t, false);
  }

  /** Returns to UPRIGHT and re-arms, keeping the learned velocity baseline. */
  private standDown(): void {
    this.state = "UPRIGHT";
    this.descendingSince = 0;
    this.possibleFallSince = 0;
    this.confirmedAt = 0;
    this.peakHipVelocity = 0;
    this.recoveryFrames = 0;
    this.fallPostureFrames = 0;
    this.emitted = false;
    this.evidence = null;
  }

  private persistenceElapsed(t: number): number {
    if (this.state === "POSSIBLE_FALL") {
      return Math.max(0, t - this.possibleFallSince);
    }
    if (this.state === "CONFIRMED_FALL") {
      return this.confirmedPersistenceMs;
    }
    return 0;
  }

  private countEvidence(features: FallFeatures): number {
    const { velocity, torso, aspect } = FALL_CONFIG;
    let count = 0;
    if (this.peakHipVelocity >= velocity.fallThreshold) count += 1;
    if (features.torsoAngle >= torso.horizontalMinAngle) count += 1;
    if (features.aspectRatio >= aspect.horizontalMinRatio) count += 1;
    if (features.isLowInFrame) count += 1;
    return count;
  }

  private computeScores(
    features: FallFeatures,
    persistenceMs: number,
  ): FallSignalScores {
    const { velocity, torso, aspect, position, stateMachine } = FALL_CONFIG;
    return {
      rapidDescent: normalizeRange(
        this.peakHipVelocity,
        velocity.descendingThreshold,
        velocity.fallThreshold,
      ),
      horizontalTorso: normalizeRange(
        features.torsoAngle,
        torso.uprightMaxAngle,
        torso.horizontalMinAngle,
      ),
      aspectRatio: normalizeRange(
        features.aspectRatio,
        aspect.standingMaxRatio,
        aspect.horizontalMinRatio,
      ),
      lowPosition: Math.max(
        normalizeRange(features.hipY, position.uprightHipY, position.lowHipY),
        normalizeRange(features.verticalDrop, 0, position.minDropForFall),
      ),
      persistence: normalizeRange(persistenceMs, 0, stateMachine.persistenceMs),
    };
  }

  private weightedConfidence(scores: FallSignalScores): number {
    const w = FALL_CONFIG.confidence.weights;
    return Math.min(
      1,
      scores.rapidDescent * w.rapidDescent +
        scores.horizontalTorso * w.horizontalTorso +
        scores.aspectRatio * w.aspectRatio +
        scores.lowPosition * w.lowPosition +
        scores.persistence * w.persistence,
    );
  }

  private buildSnapshot(
    previousState: FallState,
    features: FallFeatures | null,
    t: number,
    shouldEmit: boolean,
  ): FallDetectorSnapshot {
    return {
      state: this.state,
      previousState,
      stateChanged: this.state !== previousState,
      confidence: this.confidence,
      scores: this.scores,
      persistenceMs: this.persistenceElapsed(t),
      peakHipVelocity: this.peakHipVelocity,
      evidenceCount: this.evidenceCount,
      features,
      shouldEmit,
      evidence: shouldEmit ? this.evidence : null,
    };
  }
}
