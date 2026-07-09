/**
 * LUT builder (PLAN §2 sampling strategy). Resamples a y-monotonic polyline
 * to uniform Y. Per row: x, θ (tangent), dθ/dy (box-smoothed). Built once per
 * breakpoint at init; per-frame cost is an index + lerp, allocation-free.
 */

export interface Lut {
  n: number;
  height: number;
  x: Float32Array;
  theta: Float32Array;
  dThetaDy: Float32Array;
}

export interface LutSample {
  x: number;
  y: number;
  theta: number;
  dThetaDy: number;
}

const SMOOTH_WINDOW = 9;

export function buildLut(pts: ReadonlyArray<readonly [number, number]>, n = 2000): Lut {
  if (pts.length < 2) throw new Error("buildLut needs at least 2 points");
  const height = pts[pts.length - 1]![1];
  const x = new Float32Array(n);
  const theta = new Float32Array(n);
  const dThetaDy = new Float32Array(n);
  const dy = height / (n - 1);

  // Uniform-Y resample of x via linear interpolation over the polyline.
  let seg = 0;
  for (let i = 0; i < n; i++) {
    const y = i * dy;
    while (seg < pts.length - 2 && pts[seg + 1]![1] < y) seg++;
    const [x0, y0] = pts[seg]!;
    const [x1, y1] = pts[seg + 1]!;
    const f = y1 === y0 ? 0 : (y - y0) / (y1 - y0);
    x[i] = x0 + f * (x1 - x0);
  }

  // Tangent via forward difference (backward at the last row).
  for (let i = 0; i < n; i++) {
    const j = Math.min(i, n - 2);
    theta[i] = Math.atan2(dy, x[j + 1]! - x[j]!);
  }

  // dθ/dy via forward difference, box-smoothed so authoring noise doesn't
  // flicker the pose system.
  const raw = new Float32Array(n);
  for (let i = 0; i < n - 1; i++) raw[i] = (theta[i + 1]! - theta[i]!) / dy;
  raw[n - 1] = raw[n - 2]!;
  const half = (SMOOTH_WINDOW - 1) / 2;
  for (let i = 0; i < n; i++) {
    let sum = 0;
    let count = 0;
    for (let k = -half; k <= half; k++) {
      const j = i + k;
      if (j >= 0 && j < n) {
        sum += raw[j]!;
        count++;
      }
    }
    dThetaDy[i] = sum / count;
  }

  return { n, height, x, theta, dThetaDy };
}

/** O(1) sample at t ∈ [0,1]: row index + lerp. */
export function sampleLut(lut: Lut, t: number): LutSample {
  const clamped = Math.min(1, Math.max(0, t));
  const pos = clamped * (lut.n - 1);
  const i = Math.min(lut.n - 2, Math.floor(pos));
  const f = pos - i;
  const lerp = (a: Float32Array) => a[i]! + f * (a[i + 1]! - a[i]!);
  return {
    x: lerp(lut.x),
    y: clamped * lut.height,
    theta: lerp(lut.theta),
    dThetaDy: lerp(lut.dThetaDy),
  };
}

/**
 * Time-based exponential smoother (critically-damped feel, frame-rate
 * independent): returns the new current value after dtMs.
 */
export function smooth(
  current: number,
  target: number,
  dtMs: number,
  tauMs: number,
): number {
  return target + (current - target) * Math.exp(-dtMs / tauMs);
}
