/**
 * Rider pose tuning (PLAN §5). Keeping the thresholds and derivation pure
 * makes the character easy to tune with the HUD and protects it with unit
 * tests instead of scattering magic numbers through the rAF loop.
 */

export const RIDER_POSES = [
  "idle",
  "tuck",
  "carve-left",
  "carve-right",
  "compress",
  "unweight",
  "switch",
  "brake",
] as const;

export type RiderPose = (typeof RIDER_POSES)[number];

export const POSE_THRESHOLDS = {
  /** The top of the run is the only place the idle loop is allowed. */
  idleT: 0.018,
  idleVelocity: 0.035,
  /** Reverse must be sustained to avoid trackpad-inertia stance flicker. */
  reverseVelocity: 0.04,
  reverseHysteresisMs: 150,
  /** Curve rate is dθ/dy normalized to the current trail's full height. */
  carveCurve: 10,
  tuckCurveMax: 8,
  tuckVelocity: 0.65,
  /** The second-derivative channel creates rollers without Y reversals. */
  roller: 0.075,
  brakeT: 0.97,
  /** Continuous channels are deliberately capped; character, not slapstick. */
  leanCurve: 110,
  maxLeanDeg: 13,
  crouchRoll: 0.22,
} as const;

export interface PoseSignals {
  t: number;
  velocity: number;
  /** Signed, height-normalized curve rate. */
  curvature: number;
  /** Signed curve-rate change scaled by scroll velocity. */
  roll: number;
  reverseMs: number;
  decelerating: boolean;
}

export interface MotionChannels {
  leanDeg: number;
  /** -1 = unweight, 0 = neutral, +1 = compressed. */
  crouch: number;
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

/**
 * The discrete state machine. Priority matters: a deliberate switch is more
 * legible than a carve, and the run must land in a brake at the base.
 */
export function deriveRiderPose({
  t,
  velocity,
  curvature,
  roll,
  reverseMs,
  decelerating,
}: PoseSignals): RiderPose {
  const speed = Math.abs(velocity);

  if (reverseMs >= POSE_THRESHOLDS.reverseHysteresisMs) return "switch";
  if (
    t >= POSE_THRESHOLDS.brakeT &&
    velocity >= -POSE_THRESHOLDS.reverseVelocity &&
    (decelerating || speed <= POSE_THRESHOLDS.idleVelocity)
  ) {
    return "brake";
  }
  if (t <= POSE_THRESHOLDS.idleT && speed <= POSE_THRESHOLDS.idleVelocity) {
    return "idle";
  }
  if (roll >= POSE_THRESHOLDS.roller) return "compress";
  if (roll <= -POSE_THRESHOLDS.roller) return "unweight";
  if (
    speed >= POSE_THRESHOLDS.tuckVelocity &&
    Math.abs(curvature) <= POSE_THRESHOLDS.tuckCurveMax
  ) {
    return "tuck";
  }
  if (curvature >= POSE_THRESHOLDS.carveCurve) return "carve-right";
  if (curvature <= -POSE_THRESHOLDS.carveCurve) return "carve-left";

  // Gentle, nearly straight sections retain a directional carve rather than
  // popping back to idle; the continuous lean channel keeps it alive.
  return curvature >= 0 ? "carve-right" : "carve-left";
}

export function deriveMotionChannels(
  { curvature, roll }: PoseSignals,
  target: MotionChannels = { leanDeg: 0, crouch: 0 },
): MotionChannels {
  target.leanDeg = clamp(
    (curvature / POSE_THRESHOLDS.leanCurve) * POSE_THRESHOLDS.maxLeanDeg,
    -POSE_THRESHOLDS.maxLeanDeg,
    POSE_THRESHOLDS.maxLeanDeg,
  );
  target.crouch = clamp(roll / POSE_THRESHOLDS.crouchRoll, -1, 1);
  return target;
}
