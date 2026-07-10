import type { LinePoint } from "../../content/types.ts";
import { sampleLine } from "./spline.ts";

/**
 * The 3D line LUT (PLAN-3D §2): dense Catmull-Rom samples → arc length →
 * speed-profile time → anchor-warped ride time → resampled to N rows uniform
 * in ride time t ∈ [0,1]. Anchors pin each waypoint's bench to its content
 * `t`, so scroll position, the hidden flow document, and the camera agree by
 * construction. Built once at init; per-frame cost is an index + lerp,
 * allocation-free (v1 lut.ts discipline).
 */

export interface LineAnchor {
  id: string;
  /** Ride time this anchor must land on — the waypoint's content t. */
  t: number;
}

export interface LineLut {
  n: number;
  /** Total path length, meters. */
  length: number;
  /** n×3 world positions. */
  pos: Float32Array;
  /** n×3 unit tangents. */
  tan: Float32Array;
  /** Signed horizontal curvature, 1/m; positive = heading swinging toward +x. */
  curvature: Float32Array;
  /** Descent angle below horizontal, radians; positive = downhill. */
  grade: Float32Array;
  /** Speed-profile multiplier at each row (drives spray/FOV later). */
  speed: Float32Array;
  /** Path meters covered per unit t at each row: world speed = dsdt/rideSeconds. */
  dsdt: Float32Array;
}

export interface LineLutSample {
  pos: [number, number, number];
  tan: [number, number, number];
  curvature: number;
  grade: number;
  speed: number;
  dsdt: number;
}

const SMOOTH_WINDOW = 9;

function boxSmooth(src: Float32Array): Float32Array {
  const n = src.length;
  const out = new Float32Array(n);
  const half = (SMOOTH_WINDOW - 1) / 2;
  for (let i = 0; i < n; i++) {
    let sum = 0;
    let count = 0;
    for (let k = -half; k <= half; k++) {
      const j = i + k;
      if (j >= 0 && j < n) {
        sum += src[j]!;
        count++;
      }
    }
    out[i] = sum / count;
  }
  return out;
}

const wrapAngle = (a: number) =>
  a > Math.PI ? a - 2 * Math.PI : a < -Math.PI ? a + 2 * Math.PI : a;

export function buildLineLut(
  points: readonly LinePoint[],
  anchors: readonly LineAnchor[],
  n = 4096,
  perSegment = 32,
): LineLut {
  const samples = sampleLine(points, perSegment);
  const m = samples.length;

  // Arc length and raw profile time τ = ∫ ds / speed.
  const arc = new Float64Array(m);
  const tau = new Float64Array(m);
  for (let j = 1; j < m; j++) {
    const a = samples[j - 1]!.pos;
    const b = samples[j]!.pos;
    const ds = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const v = Math.max((samples[j - 1]!.speed + samples[j]!.speed) / 2, 0.05);
    arc[j] = arc[j - 1]! + ds;
    tau[j] = tau[j - 1]! + ds / v;
  }
  const length = arc[m - 1]!;

  // Anchor warp: piecewise-linear rescale of τ so each anchored sample lands
  // exactly on its content t. Implicit anchors close the ends at t=0 and t=1.
  const anchorById = new Map(anchors.map((a) => [a.id, a.t]));
  const pins: Array<{ tau: number; t: number }> = [{ tau: 0, t: 0 }];
  for (let j = 0; j < m; j++) {
    const id = samples[j]!.waypointId;
    if (!id) continue;
    const t = anchorById.get(id);
    if (t === undefined) throw new Error(`line anchors "${id}" but no content t given`);
    pins.push({ tau: tau[j]!, t });
  }
  pins.push({ tau: tau[m - 1]!, t: 1 });
  for (let k = 1; k < pins.length; k++) {
    if (pins[k]!.tau <= pins[k - 1]!.tau || pins[k]!.t <= pins[k - 1]!.t) {
      throw new Error(
        `line anchors out of order at t=${pins[k]!.t} (ride reaches waypoints in content order or not at all)`,
      );
    }
  }
  const rideT = new Float64Array(m);
  let pin = 0;
  for (let j = 0; j < m; j++) {
    while (pin < pins.length - 2 && tau[j]! > pins[pin + 1]!.tau) pin++;
    const a = pins[pin]!;
    const b = pins[pin + 1]!;
    rideT[j] = a.t + ((tau[j]! - a.tau) / (b.tau - a.tau)) * (b.t - a.t);
  }

  // Resample to N rows uniform in ride time.
  const pos = new Float32Array(n * 3);
  const speed = new Float32Array(n);
  let j = 0;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    while (j < m - 2 && rideT[j + 1]! < t) j++;
    const span = rideT[j + 1]! - rideT[j]!;
    const f = span > 0 ? Math.min(1, Math.max(0, (t - rideT[j]!) / span)) : 0;
    const a = samples[j]!.pos;
    const b = samples[j + 1]!.pos;
    pos[i * 3] = a[0] + f * (b[0] - a[0]);
    pos[i * 3 + 1] = a[1] + f * (b[1] - a[1]);
    pos[i * 3 + 2] = a[2] + f * (b[2] - a[2]);
    speed[i] = samples[j]!.speed + f * (samples[j + 1]!.speed - samples[j]!.speed);
  }

  // Tangents, meters-per-t, heading-derived signed curvature, grade.
  const tan = new Float32Array(n * 3);
  const dsdt = new Float32Array(n);
  const rawCurv = new Float32Array(n);
  const grade = new Float32Array(n);
  const heading = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const k = Math.min(i, n - 2);
    const dx = pos[(k + 1) * 3]! - pos[k * 3]!;
    const dy = pos[(k + 1) * 3 + 1]! - pos[k * 3 + 1]!;
    const dz = pos[(k + 1) * 3 + 2]! - pos[k * 3 + 2]!;
    const ds = Math.hypot(dx, dy, dz);
    const inv = ds > 0 ? 1 / ds : 0;
    tan[i * 3] = dx * inv;
    tan[i * 3 + 1] = dy * inv;
    tan[i * 3 + 2] = dz * inv;
    dsdt[i] = ds * (n - 1);
    heading[i] = Math.atan2(dx, dz);
    grade[i] = Math.atan2(-dy, Math.hypot(dx, dz));
  }
  for (let i = 0; i < n - 1; i++) {
    const dsxz =
      Math.hypot(
        pos[(i + 1) * 3]! - pos[i * 3]!,
        pos[(i + 1) * 3 + 2]! - pos[i * 3 + 2]!,
      ) || 1e-9;
    rawCurv[i] = wrapAngle(heading[i + 1]! - heading[i]!) / dsxz;
  }
  rawCurv[n - 1] = rawCurv[n - 2]!;

  return {
    n,
    length,
    pos,
    tan,
    curvature: boxSmooth(rawCurv),
    grade,
    speed,
    dsdt,
  };
}

/** O(1) sample at t ∈ [0,1] into a caller-owned record — allocation-free. */
export function sampleLineLut(
  lut: LineLut,
  t: number,
  out: LineLutSample,
): LineLutSample {
  const clamped = Math.min(1, Math.max(0, t));
  const posIdx = clamped * (lut.n - 1);
  const i = Math.min(lut.n - 2, Math.floor(posIdx));
  const f = posIdx - i;
  for (let axis = 0; axis < 3; axis++) {
    out.pos[axis] =
      lut.pos[i * 3 + axis]! +
      f * (lut.pos[(i + 1) * 3 + axis]! - lut.pos[i * 3 + axis]!);
    out.tan[axis] =
      lut.tan[i * 3 + axis]! +
      f * (lut.tan[(i + 1) * 3 + axis]! - lut.tan[i * 3 + axis]!);
  }
  const lerp = (a: Float32Array) => a[i]! + f * (a[i + 1]! - a[i]!);
  out.curvature = lerp(lut.curvature);
  out.grade = lerp(lut.grade);
  out.speed = lerp(lut.speed);
  out.dsdt = lerp(lut.dsdt);
  return out;
}

export function emptyLineLutSample(): LineLutSample {
  return {
    pos: [0, 0, 0],
    tan: [0, 0, 0],
    curvature: 0,
    grade: 0,
    speed: 0,
    dsdt: 0,
  };
}
