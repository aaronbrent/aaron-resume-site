/**
 * Trail path generator (PLAN §2). The run is authored in code as a smooth
 * meander: x'(y) = k · tanh(S · sin(u(y))), where u advances by odd multiples
 * of π between waypoints so the line lands on alternating plateaus (left /
 * right of the fall line) at each waypoint. tanh squares up the wave, giving
 * sustained carves with quick, smooth direction flips.
 *
 * Output is cubic Hermite segments in a normalized 1000-wide viewBox with y
 * strictly increasing — the property every downstream system (LUT, camera,
 * validator) relies on.
 */

export interface TrailWaypointSpec {
  id: string;
  /** Normalized position down the run, ∈ (0,1) */
  t: number;
}

export interface TrailConfig {
  /** viewBox height in normalized units (width is always 1000) */
  height: number;
  /** Horizontal drift rate on plateaus: dx/dy. Slope angle = atan(1/k). */
  k: number;
  /** Direction flips per gap: [before wp0, wp0→wp1, …, after last]. Odd = alternate sides. */
  flipsPerGap: number[];
  waypoints: TrailWaypointSpec[];
  /** Squareness of the wave (tanh steepness) */
  squareness?: number;
  /** Approximate number of cubic segments to emit */
  segments?: number;
}

export interface TrailMarker {
  id: string;
  t: number;
  x: number;
  y: number;
}

export interface GeneratedTrail {
  d: string;
  viewBox: [number, number];
  markers: TrailMarker[];
}

const FINE_STEPS = 4000;

/** Piecewise-linear interpolation over (t, u) knots. */
function interpKnots(knots: Array<[number, number]>, t: number): number {
  for (let i = 1; i < knots.length; i++) {
    const [t0, u0] = knots[i - 1]!;
    const [t1, u1] = knots[i]!;
    if (t <= t1 || i === knots.length - 1) {
      const f = (t - t0) / (t1 - t0);
      return u0 + f * (u1 - u0);
    }
  }
  return knots[knots.length - 1]![1];
}

export function generateTrail(config: TrailConfig): GeneratedTrail {
  const { height, k, flipsPerGap, waypoints } = config;
  const squareness = config.squareness ?? 2.5;
  const segments = config.segments ?? 64;

  if (flipsPerGap.length !== waypoints.length + 1) {
    throw new Error("flipsPerGap must have waypoints.length + 1 entries");
  }

  // Build u(t) knots: waypoint 0 sits at u = -π/2 (a plateau); u advances by
  // flips[i]·π per gap, and the run start sits flips[0]·π before waypoint 0.
  const knots: Array<[number, number]> = [];
  const uAt: number[] = [];
  let acc = -Math.PI / 2;
  for (let i = 0; i < waypoints.length; i++) {
    if (i > 0) acc += flipsPerGap[i]! * Math.PI;
    uAt.push(acc);
  }
  knots.push([0, uAt[0]! - flipsPerGap[0]! * Math.PI]);
  waypoints.forEach((wp, i) => knots.push([wp.t, uAt[i]!]));
  knots.push([1, uAt[uAt.length - 1]! + flipsPerGap[flipsPerGap.length - 1]! * Math.PI]);

  // Integrate x'(y) at fine resolution.
  const xs = new Float64Array(FINE_STEPS + 1);
  const dxdy = new Float64Array(FINE_STEPS + 1);
  const dy = height / FINE_STEPS;
  let x = 0;
  for (let i = 0; i <= FINE_STEPS; i++) {
    const t = i / FINE_STEPS;
    const w = Math.tanh(squareness * Math.sin(interpKnots(knots, t)));
    dxdy[i] = k * w;
    xs[i] = x;
    x += k * w * dy;
  }

  // Recenter and, only if the meander overflows the margins, compress toward
  // the center (compression steepens slope slightly; validator is the gate).
  let min = Infinity;
  let max = -Infinity;
  for (const v of xs) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const mid = (min + max) / 2;
  const halfSpan = (max - min) / 2 || 1;
  const MARGIN_LO = 60;
  const MARGIN_HI = 940;
  const maxHalf = (MARGIN_HI - MARGIN_LO) / 2;
  const scale = Math.min(1, maxHalf / halfSpan);
  for (let i = 0; i <= FINE_STEPS; i++) {
    xs[i] = 500 + (xs[i]! - mid) * scale;
    dxdy[i] = dxdy[i]! * scale;
  }

  // Emit cubic Hermite segments (y linear in the Bézier parameter → strictly
  // monotonic by construction).
  const step = Math.max(1, Math.round(FINE_STEPS / segments));
  const r1 = (v: number) => Math.round(v * 10) / 10;
  const parts: string[] = [`M ${r1(xs[0]!)} 0`];
  const markers: TrailMarker[] = [];
  for (let i = 0; i < FINE_STEPS; i += step) {
    const j = Math.min(i + step, FINE_STEPS);
    const y0 = (i / FINE_STEPS) * height;
    const y1 = (j / FINE_STEPS) * height;
    const h = y1 - y0;
    const c1x = xs[i]! + (dxdy[i]! * h) / 3;
    const c2x = xs[j]! - (dxdy[j]! * h) / 3;
    parts.push(
      `C ${r1(c1x)} ${r1(y0 + h / 3)} ${r1(c2x)} ${r1(y1 - h / 3)} ${r1(xs[j]!)} ${r1(y1)}`,
    );
  }

  for (const wp of waypoints) {
    const i = Math.round(wp.t * FINE_STEPS);
    markers.push({ id: wp.id, t: wp.t, x: r1(xs[i]!), y: r1(wp.t * height) });
  }

  return { d: parts.join(" "), viewBox: [1000, height], markers };
}
