/**
 * Trail validator (PLAN §2). Runs in CI (`pnpm trail:validate`) and in unit
 * tests. Parses the generated d string (M + C segments only), samples it
 * finely, and enforces the authoring rules:
 *
 *  - y strictly monotonic (no uphill)
 *  - slope stays sport-plausible: never shallower than 30° from horizontal;
 *    brief near-vertical moments are allowed only at direction flips (a smooth
 *    left→right turn necessarily passes through vertical), capped at 18% of
 *    samples steeper than 75°
 *  - x within [40, 960]
 *  - waypoint t spacing ≥ minimum dwell, markers actually on the line
 *  - curvature spikes flagged (a kink reads as a crash to the pose system)
 */

import type { TrailMarker } from "./generate.ts";

export interface ValidationResult {
  ok: boolean;
  errors: string[];
  stats: {
    samples: number;
    minAngleDeg: number;
    steepFraction: number;
    maxTurnDegPerSample: number;
    xMin: number;
    xMax: number;
  };
}

interface Cubic {
  p0: [number, number];
  c1: [number, number];
  c2: [number, number];
  p1: [number, number];
}

export function parsePath(d: string): Cubic[] {
  const tokens = d.trim().split(/[\s,]+/);
  const cubics: Cubic[] = [];
  let i = 0;
  let cursor: [number, number] | null = null;
  const num = () => {
    const v = Number(tokens[i++]);
    if (Number.isNaN(v)) throw new Error(`Bad number in path at token ${i - 1}`);
    return v;
  };
  while (i < tokens.length) {
    const cmd = tokens[i++];
    if (cmd === "M") {
      cursor = [num(), num()];
    } else if (cmd === "C") {
      if (!cursor) throw new Error("C before M");
      const c1: [number, number] = [num(), num()];
      const c2: [number, number] = [num(), num()];
      const p1: [number, number] = [num(), num()];
      cubics.push({ p0: cursor, c1, c2, p1 });
      cursor = p1;
    } else {
      throw new Error(`Unsupported path command: ${cmd} (generator emits M/C only)`);
    }
  }
  return cubics;
}

function cubicAt(c: Cubic, s: number): [number, number] {
  const u = 1 - s;
  const a = u * u * u;
  const b = 3 * u * u * s;
  const cc = 3 * u * s * s;
  const dd = s * s * s;
  return [
    a * c.p0[0] + b * c.c1[0] + cc * c.c2[0] + dd * c.p1[0],
    a * c.p0[1] + b * c.c1[1] + cc * c.c2[1] + dd * c.p1[1],
  ];
}

export function samplePath(d: string, perCubic = 40): Array<[number, number]> {
  const cubics = parsePath(d);
  const pts: Array<[number, number]> = [];
  cubics.forEach((c, ci) => {
    const start = ci === 0 ? 0 : 1;
    for (let k = start; k <= perCubic; k++) pts.push(cubicAt(c, k / perCubic));
  });
  return pts;
}

export interface TrailToValidate {
  d: string;
  viewBox: [number, number];
  markers: TrailMarker[];
}

export const RULES = {
  X_MIN: 40,
  X_MAX: 960,
  MIN_ANGLE_DEG: 30,
  STEEP_ANGLE_DEG: 75,
  MAX_STEEP_FRACTION: 0.18,
  MAX_TURN_DEG_PER_SAMPLE: 15,
  MIN_WAYPOINT_DT: 0.1,
  MARKER_TOLERANCE: 8,
} as const;

export function validateTrail(trail: TrailToValidate): ValidationResult {
  const errors: string[] = [];
  const [, height] = trail.viewBox;
  let pts: Array<[number, number]> = [];
  try {
    pts = samplePath(trail.d);
  } catch (e) {
    return {
      ok: false,
      errors: [(e as Error).message],
      stats: {
        samples: 0,
        minAngleDeg: 0,
        steepFraction: 0,
        maxTurnDegPerSample: 0,
        xMin: 0,
        xMax: 0,
      },
    };
  }

  let minAngle = 90;
  let steep = 0;
  let maxTurn = 0;
  let xMin = Infinity;
  let xMax = -Infinity;
  let prevTheta: number | null = null;

  for (let i = 0; i < pts.length; i++) {
    const [x, y] = pts[i]!;
    if (x < xMin) xMin = x;
    if (x > xMax) xMax = x;
    if (x < RULES.X_MIN || x > RULES.X_MAX) {
      errors.push(`x out of bounds at sample ${i}: ${x.toFixed(1)}`);
      break;
    }
    if (i === 0) continue;
    const [px, py] = pts[i - 1]!;
    const dx = x - px;
    const dy = y - py;
    if (dy <= 0) {
      errors.push(`y not strictly increasing at sample ${i} (y=${y.toFixed(1)})`);
      break;
    }
    const angleFromHorizontal = (Math.atan2(dy, Math.abs(dx)) * 180) / Math.PI;
    if (angleFromHorizontal < minAngle) minAngle = angleFromHorizontal;
    if (angleFromHorizontal > RULES.STEEP_ANGLE_DEG) steep++;
    const theta = (Math.atan2(dy, dx) * 180) / Math.PI;
    if (prevTheta !== null) {
      const turn = Math.abs(theta - prevTheta);
      if (turn > maxTurn) maxTurn = turn;
    }
    prevTheta = theta;
  }

  const steepFraction = steep / (pts.length - 1);
  if (minAngle < RULES.MIN_ANGLE_DEG - 0.5) {
    errors.push(
      `slope too shallow: ${minAngle.toFixed(1)}° < ${RULES.MIN_ANGLE_DEG}° (fast horizontal sweep)`,
    );
  }
  if (steepFraction > RULES.MAX_STEEP_FRACTION) {
    errors.push(
      `too much near-vertical: ${(steepFraction * 100).toFixed(1)}% of samples steeper than ${RULES.STEEP_ANGLE_DEG}°`,
    );
  }
  if (maxTurn > RULES.MAX_TURN_DEG_PER_SAMPLE) {
    errors.push(
      `curvature spike: ${maxTurn.toFixed(1)}° turn in one sample (kink — pose system would read a crash)`,
    );
  }

  // Markers: ordered, spaced, and on the line.
  for (let i = 0; i < trail.markers.length; i++) {
    const m = trail.markers[i]!;
    if (m.t <= 0 || m.t >= 1) errors.push(`marker ${m.id}: t=${m.t} outside (0,1)`);
    if (i > 0) {
      const dt = m.t - trail.markers[i - 1]!.t;
      if (dt < RULES.MIN_WAYPOINT_DT)
        errors.push(`marker ${m.id}: spacing ${dt.toFixed(2)} < minimum dwell`);
    }
    const y = m.t * height;
    let best = Infinity;
    for (const [px, py] of pts) {
      if (Math.abs(py - y) < height / 200) best = Math.min(best, Math.abs(px - m.x));
    }
    if (best > RULES.MARKER_TOLERANCE) {
      errors.push(`marker ${m.id}: ${best.toFixed(1)} units off the line`);
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    stats: {
      samples: pts.length,
      minAngleDeg: Math.round(minAngle * 10) / 10,
      steepFraction: Math.round(steepFraction * 1000) / 1000,
      maxTurnDegPerSample: Math.round(maxTurn * 10) / 10,
      xMin: Math.round(xMin),
      xMax: Math.round(xMax),
    },
  };
}
