import type { LinePoint } from "../../content/types.ts";

/**
 * Centripetal Catmull-Rom sampling of the 3D line (PLAN-3D §2). Centripetal
 * knots (α = 0.5) because the line has tight benches next to long fall-line
 * segments — uniform knots overshoot exactly there, and an overshoot in y is
 * an uphill the validator must reject.
 *
 * Pure math, no renderer types: the same module feeds the runtime LUT, the
 * unit tests, and the CI validator.
 */

export interface LineSample {
  pos: readonly [number, number, number];
  /** Speed-profile multiplier, lerped between control points. */
  speed: number;
  /** Present on the sample sitting exactly at an anchored control point. */
  waypointId?: string;
}

const ALPHA = 0.5;

function knot(prev: number, a: readonly number[], b: readonly number[]): number {
  const d = Math.hypot(b[0]! - a[0]!, b[1]! - a[1]!, b[2]! - a[2]!);
  // Coincident control points would collapse the knot interval; nudge.
  return prev + Math.max(d ** ALPHA, 1e-6);
}

/** Barry–Goldman pyramid for one segment, u ∈ [t1, t2]. */
function evalSegment(
  p0: readonly number[],
  p1: readonly number[],
  p2: readonly number[],
  p3: readonly number[],
  t0: number,
  t1: number,
  t2: number,
  t3: number,
  u: number,
  out: [number, number, number],
): void {
  for (let axis = 0; axis < 3; axis++) {
    const a1 = ((t1 - u) * p0[axis]! + (u - t0) * p1[axis]!) / (t1 - t0);
    const a2 = ((t2 - u) * p1[axis]! + (u - t1) * p2[axis]!) / (t2 - t1);
    const a3 = ((t3 - u) * p2[axis]! + (u - t2) * p3[axis]!) / (t3 - t2);
    const b1 = ((t2 - u) * a1 + (u - t0) * a2) / (t2 - t0);
    const b2 = ((t3 - u) * a2 + (u - t1) * a3) / (t3 - t1);
    out[axis] = ((t2 - u) * b1 + (u - t1) * b2) / (t2 - t1);
  }
}

/**
 * Samples the whole line at `perSegment` steps per control segment. Control
 * points land exactly on samples, so anchored waypoints keep their identity
 * through to the LUT's time warp.
 */
export function sampleLine(points: readonly LinePoint[], perSegment = 32): LineSample[] {
  if (points.length < 2) throw new Error("sampleLine needs at least 2 control points");
  const p = points.map((cp) => cp.p);
  // Clamped ends via reflection: P(-1) = 2·P0 − P1, P(n) = 2·P(n−1) − P(n−2).
  const first = [
    2 * p[0]![0] - p[1]![0],
    2 * p[0]![1] - p[1]![1],
    2 * p[0]![2] - p[1]![2],
  ] as const;
  const last = [
    2 * p[p.length - 1]![0] - p[p.length - 2]![0],
    2 * p[p.length - 1]![1] - p[p.length - 2]![1],
    2 * p[p.length - 1]![2] - p[p.length - 2]![2],
  ] as const;
  const ext: ReadonlyArray<readonly number[]> = [first, ...p, last];

  const samples: LineSample[] = [];
  const scratch: [number, number, number] = [0, 0, 0];
  for (let seg = 0; seg < points.length - 1; seg++) {
    const p0 = ext[seg]!;
    const p1 = ext[seg + 1]!;
    const p2 = ext[seg + 2]!;
    const p3 = ext[seg + 3]!;
    const t0 = 0;
    const t1 = knot(t0, p0, p1);
    const t2 = knot(t1, p1, p2);
    const t3 = knot(t2, p2, p3);
    const s0 = points[seg]!.speed ?? 1;
    const s1 = points[seg + 1]!.speed ?? 1;
    for (let i = 0; i < perSegment; i++) {
      const f = i / perSegment;
      evalSegment(p0, p1, p2, p3, t0, t1, t2, t3, t1 + f * (t2 - t1), scratch);
      samples.push({
        pos: [scratch[0], scratch[1], scratch[2]],
        speed: s0 + f * (s1 - s0),
        ...(i === 0 && points[seg]!.waypointId
          ? { waypointId: points[seg]!.waypointId }
          : {}),
      });
    }
  }
  const end = points[points.length - 1]!;
  samples.push({
    pos: [end.p[0], end.p[1], end.p[2]],
    speed: end.speed ?? 1,
    ...(end.waypointId ? { waypointId: end.waypointId } : {}),
  });
  return samples;
}
