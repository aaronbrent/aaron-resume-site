import type { LineLutSample } from "~/lib/line/lut3d";

/**
 * First-person camera dynamics (PLAN-3D §5): every channel derives from the
 * same LUT sample the camera rides — signed curvature banks the head, speed
 * widens the lens and lengthens the gaze, grade and turn load compress the
 * stance. Derived, never keyframed, and capped by the comfort budget (§8):
 * roll ≤ 12°, FOV swing ≤ 13°, no oscillators, no head-bob.
 *
 * This module only produces targets; the frame loop eases toward them so a
 * deep-link jump snaps and a carve breathes.
 */

export const DYNAMICS_LIMITS = {
  /** Comfort cap on camera roll (§8). Degrees. */
  maxBankDeg: 12,
  baseFovDeg: 65,
  /** 13° swing cap (§8). */
  maxFovDeg: 78,
  eyeHeightM: 1.7,
  /** Deepest crouch: eye drop at full compression (§5). */
  maxCrouchM: 0.35,
  /** Gaze distance in ride time: short in a slow carve, long in a schuss. */
  minLookAheadT: 0.004,
  maxLookAheadT: 0.011,
  /** Board steering cue for the POV overlay, signed like bank. */
  maxBoardYawDeg: 9,
} as const;

export interface Dynamics {
  /** Signed camera roll, positive banking with positive LUT curvature. */
  bankDeg: number;
  fovDeg: number;
  /** Eye height after crouch, meters above the line. */
  eyeHeightM: number;
  lookAheadT: number;
  boardYawDeg: number;
}

type DynamicsInput = Pick<LineLutSample, "curvature" | "grade" | "speed">;

/** Curvature × speed → carve signal; tanh keeps detail and enforces the cap. */
const BANK_GAIN = 46;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

const smooth01 = (edge0: number, edge1: number, x: number) => {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
};

export function emptyDynamics(): Dynamics {
  return {
    bankDeg: 0,
    fovDeg: DYNAMICS_LIMITS.baseFovDeg,
    eyeHeightM: DYNAMICS_LIMITS.eyeHeightM,
    lookAheadT: DYNAMICS_LIMITS.minLookAheadT,
    boardYawDeg: 0,
  };
}

/** Derive pose targets from one LUT sample into a caller-owned record. */
export function deriveDynamics(sample: DynamicsInput, out: Dynamics): Dynamics {
  const speed = clamp01(Number.isFinite(sample.speed) ? sample.speed : 0);
  const curvature = Number.isFinite(sample.curvature) ? sample.curvature : 0;
  const grade = Math.max(0, Number.isFinite(sample.grade) ? sample.grade : 0);

  const carve = Math.tanh(curvature * speed * BANK_GAIN);
  const pace = smooth01(0.25, 0.95, speed);
  const pitch = smooth01((4 * Math.PI) / 180, (27 * Math.PI) / 180, grade);

  out.bankDeg = carve * DYNAMICS_LIMITS.maxBankDeg;
  out.boardYawDeg = carve * DYNAMICS_LIMITS.maxBoardYawDeg;
  out.fovDeg =
    DYNAMICS_LIMITS.baseFovDeg +
    pace * (DYNAMICS_LIMITS.maxFovDeg - DYNAMICS_LIMITS.baseFovDeg);
  // Tuck with speed and pitch, load into the turn — never below the cap.
  const crouch =
    clamp01(pace * (0.4 + 0.4 * pitch + 0.2 * Math.abs(carve))) *
    DYNAMICS_LIMITS.maxCrouchM;
  out.eyeHeightM = DYNAMICS_LIMITS.eyeHeightM - crouch;
  // Look farther ahead at speed, slightly nearer through a tight carve.
  const gaze =
    DYNAMICS_LIMITS.minLookAheadT +
    pace * (DYNAMICS_LIMITS.maxLookAheadT - DYNAMICS_LIMITS.minLookAheadT);
  out.lookAheadT = Math.max(
    DYNAMICS_LIMITS.minLookAheadT,
    gaze * (1 - 0.2 * Math.abs(carve)),
  );
  return out;
}
