import { Vector3 } from "three";
import { clamp01, DWELL_FRACTION } from "~/lib/progress";
import { SUN_RADIUS } from "./constants";
import type { Vec3 } from "./types";

/**
 * Camera choreography (docs/PLAN-STAR-SYSTEM.md §5), pure and unit-tested.
 *
 * Stops: 0 = hero (sun fills the frame), i + 1 = planet i. Progress maps to
 * stop space as `progress * planetCount`, matching app/lib/progress.ts. Each
 * stop has a dwell window (±DWELL_FRACTION/2 of a step) where the camera
 * parks with a small cubic-eased drift. Between windows, each leg is a
 * gravity-assist "slingshot" (one C¹ curve, eased from rest to rest):
 *
 *   sling    the camera swings around the body it is leaving (the sun on the
 *            hero leg), spiralling in to a periapsis just outside its rings
 *            and moons, and leaves on the tangent toward the next planet.
 *            The body sweeps across the frame as it goes;
 *   cruise   a cubic Bézier from that tangent onto the next planet's
 *            approach line, looking at the planet;
 *   approach a short straight run into the parked pose, during which the
 *            aim settles off-centre so the planet slides beside the role
 *            card as it fades in (panels.ts REVEAL_APPROACH_START).
 */

export interface PathPlanet {
  /** World position (system-layout.ts). */
  position: Vec3;
  size: number;
  /** Keep-out radius: atmosphere, rings and moon orbits (planets/config.ts). */
  keepOut: number;
}

export interface CameraPose {
  position: Vec3;
  target: Vec3;
}

export interface CameraPathOptions {
  /** Portrait viewports put the planet in the top half (panel below). */
  portrait?: boolean;
}

/** One flight leg's shape, for tests and the layout checks. */
export interface LegInfo {
  /** Centre of the body slung around (the sun on leg 0). */
  body: Vec3;
  /** Periapsis radius around `body`. */
  periapsis: number;
  /** Angle swept around the body (rad). */
  sweep: number;
  /** Heading change from the parked view direction to the departure (rad). */
  turn: number;
  /** Start of the straight final approach. */
  approachStart: Vec3;
  /** Total path length. */
  length: number;
}

const UP = new Vector3(0, 1, 0);

/** Sun keep-out: outside the corona shell (Sun.tsx CORONA_SCALE = 3). */
export const SUN_KEEP_OUT = SUN_RADIUS * 3.3;
/** Periapsis radius when slinging around the sun on the hero leg. */
const SUN_PERIAPSIS = SUN_RADIUS * 3.6;
/** Largest angle (rad) between a parked camera and the sun, seen from the planet. */
const MAX_LIT = (60 * Math.PI) / 180;
/** Slings sweep at least this far around their body (rad). */
export const MIN_SWEEP = Math.PI / 3;

export function dwellDistance(size: number, opts: CameraPathOptions = {}): number {
  // Portrait frames are narrow: pull back so moons and rings fit.
  return (size * 4.2 + 1.2) * (opts.portrait ? 1.3 : 1);
}

/** Periapsis for slinging around a planet: just outside its keep-out. */
export function periapsisFor(planet: Pick<PathPlanet, "size" | "keepOut">): number {
  return Math.max(planet.keepOut, planet.size * 1.6) + planet.size * 0.5;
}

/** Weight of "turned away from the next planet" vs "facing the arrival". */
const DEPART_WEIGHT = 1.5;

/**
 * Where the camera parks for a planet, and what it looks at. It sits on the
 * planet's sunlit side (within MAX_LIT of the sun direction), swung toward
 * the body it arrives from (`from`) and away from the next planet (`onward`),
 * so the next leg's slingshot sweeps a good arc round the planet. A touch
 * above for a ¾ view, at a size-scaled distance.
 */
export function dwellPose(
  planet: PathPlanet,
  from: Vec3,
  opts: CameraPathOptions = {},
  onward?: Vec3,
): CameraPose {
  const p = new Vector3(...planet.position);
  const s = planet.size;
  const toSun = p.clone().negate().normalize();
  const ideal = new Vector3(...from).sub(p).normalize();
  if (onward) {
    ideal.addScaledVector(
      p
        .clone()
        .sub(new Vector3(...onward))
        .normalize(),
      DEPART_WEIGHT,
    );
    if (ideal.lengthSq() < 1e-8) ideal.copy(toSun);
    ideal.normalize();
  }
  const angle = ideal.angleTo(toSun);
  const dir =
    angle <= MAX_LIT ? ideal : slerpUnit(toSun, ideal, MAX_LIT / angle, new Vector3());
  const position = p
    .clone()
    .addScaledVector(dir, dwellDistance(s, opts))
    .addScaledVector(UP, s * 0.35);
  // Aim off-centre so the planet sits beside (landscape: right of) or above
  // (portrait) the role card instead of under it.
  const view = p.clone().sub(position).normalize();
  const right = view.clone().cross(UP).normalize();
  const target = opts.portrait
    ? p.clone().addScaledVector(UP, -s * 1.6)
    : p.clone().addScaledVector(right, -s * 1.4);
  return { position: position.toArray() as Vec3, target: target.toArray() as Vec3 };
}

/** Spherical interpolation between unit vectors (a ≠ −b). */
function slerpUnit(a: Vector3, b: Vector3, t: number, out: Vector3): Vector3 {
  const theta = Math.acos(Math.min(1, Math.max(-1, a.dot(b))));
  if (theta < 1e-6) return out.copy(a);
  const s = Math.sin(theta);
  return out
    .copy(a)
    .multiplyScalar(Math.sin((1 - t) * theta) / s)
    .addScaledVector(b, Math.sin(t * theta) / s);
}

/**
 * The hero pose: close on the sun, slightly above, sun filling most of the
 * frame. Aimed off-center like the planet shots so the sun sits beside the
 * hero text (landscape: right half) or above it (portrait).
 */
export function heroPose(opts: CameraPathOptions = {}): CameraPose {
  return opts.portrait
    ? {
        position: [0, SUN_RADIUS * 0.6, SUN_RADIUS * 5.6],
        target: [0, -SUN_RADIUS * 1.5, 0],
      }
    : {
        position: [0, SUN_RADIUS * 0.6, SUN_RADIUS * 3.9],
        target: [-SUN_RADIUS * 0.9, 0, 0],
      };
}

/** Vertical field of view for the rig (degrees). */
export function rigFov(opts: CameraPathOptions = {}): number {
  return opts.portrait ? 52 : 38;
}

export function easeInOutCubic(x: number): number {
  return x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2;
}

function smoothstep01(x: number): number {
  const t = x < 0 ? 0 : x > 1 ? 1 : x;
  return t * t * (3 - 2 * t);
}

export interface CameraPath {
  /** The pose at `progress ∈ [0, 1]` (allocates; use `poseInto` per frame). */
  poseAt(progress: number): CameraPose;
  /** Writes the pose into caller-owned vectors — allocation-free. */
  poseInto(progress: number, position: Vector3, target: Vector3): void;
  /** Number of stops (hero + planets). */
  readonly stops: number;
  /** The parked poses, hero first. */
  readonly dwells: readonly CameraPose[];
  /** Leg k flies from dwell k to dwell k + 1. */
  readonly legs: readonly LegInfo[];
}

/** Lateral drift (scene units) across a dwell window; keeps parked shots alive. */
const DWELL_DRIFT = 0.35;

/** Share of each leg's time spent on the sling (the rest cruises in). */
export const SLING_TIME = 0.45;
/** Share of the sweep spent spiralling from the dwell radius to periapsis. */
const SPIRAL_IN = 0.6;
/**
 * Leg time at which the aim starts easing off-centre to the parked framing.
 * Just before the role card begins fading in (panels.ts
 * REVEAL_APPROACH_START: 0.36 stops out ≈ leg t 0.78), so the planet slides
 * right as the card appears.
 */
export const SETTLE_START = 0.685;
/** Leg time by which the aim has swung from the parked framing to the next planet. */
const LOOK_NEXT_END = 0.5;
/** Peak pull of the aim toward the body being slung around (mid-sling). */
const BODY_PULL = 0.4;
/** Arc-length table resolution per curved segment. */
const LUT_STEPS = 96;

/** A leg's geometry and lookup tables (built once). */
interface Leg {
  info: LegInfo;
  c: Vector3;
  e1: Vector3;
  e2: Vector3;
  /** +1: angle increases toward e2; −1: the other way round. */
  spin: number;
  r0: number;
  rp: number;
  sweep: number;
  slingLut: Float64Array;
  slingLen: number;
  b0: Vector3;
  b1: Vector3;
  b2: Vector3;
  b3: Vector3;
  cruiseLut: Float64Array;
  cruiseLen: number;
  approachLen: number;
  /** Approach direction (unit): approachStart → dwell. */
  approachDir: Vector3;
  total: number;
  /** Hermite tangent (distance per unit t) at the sling/cruise knot. */
  knotSlope: number;
  fromPos: Vector3;
  fromTgt: Vector3;
  toPos: Vector3;
  toTgt: Vector3;
  next: Vector3;
  lenFrom: number;
  lenTo: number;
}

/** Sling point at sweep fraction q (and its derivative d/dq), allocation-free. */
function slingAt(leg: Leg, q: number, out: Vector3, tangent?: Vector3): void {
  const phi = leg.spin * leg.sweep * q;
  const x = q / SPIRAL_IN;
  const blend = x >= 1 ? 1 : smoothstep01(x);
  const r = leg.r0 + (leg.rp - leg.r0) * blend;
  const cos = Math.cos(phi);
  const sin = Math.sin(phi);
  out
    .copy(leg.c)
    .addScaledVector(leg.e1, r * cos)
    .addScaledVector(leg.e2, r * sin);
  if (!tangent) return;
  const dr = x >= 1 ? 0 : ((leg.rp - leg.r0) * 6 * x * (1 - x)) / SPIRAL_IN;
  const dphi = leg.spin * leg.sweep;
  // d/dq [r (cos φ e1 + sin φ e2)]
  tangent
    .set(0, 0, 0)
    .addScaledVector(leg.e1, dr * cos - r * dphi * sin)
    .addScaledVector(leg.e2, dr * sin + r * dphi * cos);
}

function bezierAt(leg: Leg, u: number, out: Vector3, tangent?: Vector3): void {
  const v = 1 - u;
  out
    .copy(leg.b0)
    .multiplyScalar(v * v * v)
    .addScaledVector(leg.b1, 3 * v * v * u)
    .addScaledVector(leg.b2, 3 * v * u * u)
    .addScaledVector(leg.b3, u * u * u);
  if (!tangent) return;
  tangent
    .copy(leg.b1)
    .sub(leg.b0)
    .multiplyScalar(3 * v * v)
    .addScaledVector(scratchT.copy(leg.b2).sub(leg.b1), 6 * v * u)
    .addScaledVector(scratchT.copy(leg.b3).sub(leg.b2), 3 * u * u);
}
const scratchT = new Vector3();

function buildLut(sample: (u: number, out: Vector3) => void): Float64Array {
  const lut = new Float64Array(LUT_STEPS + 1);
  const prev = new Vector3();
  const cur = new Vector3();
  sample(0, prev);
  for (let i = 1; i <= LUT_STEPS; i++) {
    sample(i / LUT_STEPS, cur);
    lut[i] = lut[i - 1]! + cur.distanceTo(prev);
    prev.copy(cur);
  }
  return lut;
}

/** Parameter u ∈ [0, 1] at arc length `d` along a LUT'd segment. */
function invertLut(lut: Float64Array, d: number): number {
  let lo = 0;
  let hi = LUT_STEPS;
  if (d <= 0) return 0;
  if (d >= lut[hi]!) return 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (lut[mid]! <= d) lo = mid;
    else hi = mid;
  }
  const a = lut[lo]!;
  const b = lut[hi]!;
  return (lo + (b > a ? (d - a) / (b - a) : 0)) / LUT_STEPS;
}

/**
 * Departure frame for a sling around `c` starting from `p0`, leaving along
 * `d`: e1 points from the body to the camera, e2 is d's component across it.
 * Of the two ways round, take the shorter one unless it sweeps less than
 * MIN_SWEEP (then go the long way, which is a proper slingshot).
 */
function slingFrame(c: Vector3, p0: Vector3, d: Vector3) {
  const e1 = p0.clone().sub(c).normalize();
  const e2 = d.clone().addScaledVector(e1, -d.dot(e1));
  if (e2.lengthSq() < 1e-8) {
    e2.copy(UP).cross(e1);
    if (e2.lengthSq() < 1e-8) e2.set(1, 0, 0).cross(e1);
  }
  e2.normalize();
  const beta = Math.atan2(d.dot(e2), d.dot(e1)); // ∈ [0, π]
  const tau = Math.PI * 2;
  const ccw = (((beta - Math.PI / 2) % tau) + tau) % tau;
  const cw = (((Math.PI * 1.5 - beta) % tau) + tau) % tau;
  const useCcw = ccw >= MIN_SWEEP && ccw <= cw;
  return { e1, e2, spin: useCcw ? 1 : -1, sweep: useCcw ? ccw : cw };
}

function buildLeg(
  from: CameraPose,
  to: CameraPose,
  body: Vector3,
  rp: number,
  next: Vector3,
  nextSize: number,
  opts: CameraPathOptions,
): Leg {
  const fromPos = new Vector3(...from.position);
  const fromTgt = new Vector3(...from.target);
  const toPos = new Vector3(...to.position);
  const toTgt = new Vector3(...to.target);
  const approachDir = next.clone().sub(toPos).normalize();
  const approachLen = Math.max(6, 3 * dwellDistance(nextSize, opts));
  const a = toPos.clone().addScaledVector(approachDir, -approachLen);

  const r0 = fromPos.distanceTo(body);
  // Departure direction: toward the approach start from the exit point.
  // The exit point depends on the direction, so iterate (converges fast:
  // the periapsis is small against the leg).
  const d = a.clone().sub(body).normalize();
  let frame = slingFrame(body, fromPos, d);
  const exit = new Vector3();
  for (let i = 0; i < 4; i++) {
    const phi = frame.spin * frame.sweep;
    exit
      .copy(body)
      .addScaledVector(frame.e1, rp * Math.cos(phi))
      .addScaledVector(frame.e2, rp * Math.sin(phi));
    d.copy(a).sub(exit).normalize();
    frame = slingFrame(body, fromPos, d);
  }

  const leg = {
    c: body.clone(),
    e1: frame.e1,
    e2: frame.e2,
    spin: frame.spin,
    sweep: frame.sweep,
    r0,
    rp,
    approachDir,
    approachLen,
    fromPos,
    fromTgt,
    toPos,
    toTgt,
    next: next.clone(),
    lenFrom: fromTgt.distanceTo(fromPos),
    lenTo: toTgt.distanceTo(toPos),
  } as Leg;

  // The sling's exact exit point and tangent start the cruise.
  const b0 = new Vector3();
  const t0 = new Vector3();
  slingAt(leg, 1, b0, t0);
  t0.normalize();
  const chord = a.distanceTo(b0);
  leg.b0 = b0;
  leg.b1 = b0.clone().addScaledVector(t0, chord / 3);
  leg.b2 = a.clone().addScaledVector(approachDir, -chord / 3);
  leg.b3 = a;

  leg.slingLut = buildLut((u, out) => slingAt(leg, u, out));
  leg.slingLen = leg.slingLut[LUT_STEPS]!;
  leg.cruiseLut = buildLut((u, out) => bezierAt(leg, u, out));
  leg.cruiseLen = leg.cruiseLut[LUT_STEPS]!;
  leg.total = leg.slingLen + leg.cruiseLen + approachLen;
  // Monotone (Fritsch–Carlson) cubic through (0, 0), (SLING_TIME, sling),
  // (1, total) with zero speed at both ends: harmonic mean of the secants.
  const m0 = leg.slingLen / SLING_TIME;
  const m1 = (leg.cruiseLen + approachLen) / (1 - SLING_TIME);
  leg.knotSlope = m0 > 0 && m1 > 0 ? (2 * m0 * m1) / (m0 + m1) : 0;

  const viewFrom = body.clone().sub(fromPos).normalize();
  leg.info = {
    body: body.toArray() as Vec3,
    periapsis: rp,
    sweep: frame.sweep,
    turn: viewFrom.angleTo(t0),
    approachStart: a.toArray() as Vec3,
    length: leg.total,
  };
  return leg;
}

/** Distance travelled along the leg at leg time t (monotone Hermite). */
function distanceAt(leg: Leg, t: number): number {
  const ds = leg.slingLen;
  if (t <= SLING_TIME) {
    const h = SLING_TIME;
    const x = t / h;
    // h00 · 0 + h10 · h · 0 + h01 · ds + h11 · h · slope
    return (-2 * x ** 3 + 3 * x * x) * ds + (x ** 3 - x * x) * h * leg.knotSlope;
  }
  const h = 1 - SLING_TIME;
  const x = (t - SLING_TIME) / h;
  return (
    (2 * x ** 3 - 3 * x * x + 1) * ds +
    (x ** 3 - 2 * x * x + x) * h * leg.knotSlope +
    (-2 * x ** 3 + 3 * x * x) * leg.total
  );
}

export function buildCameraPath(
  planets: readonly PathPlanet[],
  opts: CameraPathOptions = {},
): CameraPath {
  const centres = planets.map((p) => new Vector3(...p.position));
  const sun = new Vector3();
  const dwells: CameraPose[] = [heroPose(opts)];
  planets.forEach((p, i) =>
    dwells.push(
      dwellPose(
        p,
        (i === 0 ? sun : centres[i - 1]!).toArray() as Vec3,
        opts,
        planets[i + 1]?.position,
      ),
    ),
  );
  const legs: Leg[] = planets.map((p, k) =>
    buildLeg(
      dwells[k]!,
      dwells[k + 1]!,
      k === 0 ? sun : centres[k - 1]!,
      k === 0 ? SUN_PERIAPSIS : periapsisFor(planets[k - 1]!),
      centres[k]!,
      p.size,
      opts,
    ),
  );

  const dwellPos = dwells.map((d) => new Vector3(...d.position));
  const dwellTgt = dwells.map((d) => new Vector3(...d.target));
  const planetCount = planets.length;
  const halfDwell = DWELL_FRACTION / 2; // in stop units

  // Scratch (allocation-free per frame).
  const side = new Vector3();
  const vel = new Vector3();
  const dir = new Vector3();
  const other = new Vector3();

  /** The hero and final shots are exact: no drift on the end stops. */
  const driftScale = (k: number) => (k === 0 || k === planetCount ? 0 : 1);

  /** dir ← normalize(lerp(dir, b, w)); b is a unit vector. */
  function nlerpInto(b: Vector3, w: number) {
    if (w <= 0) return;
    if (w >= 1) {
      dir.copy(b);
      return;
    }
    side
      .copy(dir)
      .multiplyScalar(1 - w)
      .addScaledVector(b, w);
    if (side.lengthSq() < 1e-10) return; // antiparallel: hold the current aim
    dir.copy(side).normalize();
  }

  /** Pose on leg k at travel-local t ∈ [0, 1]. */
  function legInto(k: number, t: number, position: Vector3, target: Vector3) {
    const leg = legs[k]!;
    const s = distanceAt(leg, t);
    if (s <= leg.slingLen) {
      slingAt(leg, invertLut(leg.slingLut, s), position, vel);
    } else if (s <= leg.slingLen + leg.cruiseLen) {
      bezierAt(leg, invertLut(leg.cruiseLut, s - leg.slingLen), position, vel);
    } else {
      const u = Math.min(1, (s - leg.slingLen - leg.cruiseLen) / leg.approachLen);
      position.copy(leg.b3).addScaledVector(leg.approachDir, u * leg.approachLen);
      vel.copy(leg.approachDir);
    }
    if (t >= 1) position.copy(leg.toPos);
    if (vel.lengthSq() < 1e-12) vel.copy(leg.c).sub(position);
    vel.normalize();

    // Aim: parked target → the next planet, eased across the sling, with a
    // pull toward the body being slung around that peaks mid-sling, so it
    // stays at the edge of frame as it whips past.
    dir.copy(leg.fromTgt).sub(position).normalize();
    other.copy(leg.next).sub(position).normalize();
    nlerpInto(other, easeInOutCubic(clamp01(t / LOOK_NEXT_END)));
    other.copy(leg.c).sub(position).normalize();
    nlerpInto(other, BODY_PULL * Math.sin(Math.PI * clamp01(t / SLING_TIME)));
    other.copy(leg.toTgt).sub(position).normalize();
    nlerpInto(other, easeInOutCubic(clamp01((t - SETTLE_START) / (1 - SETTLE_START))));
    target
      .copy(position)
      .addScaledVector(dir, leg.lenFrom + (leg.lenTo - leg.lenFrom) * t);
  }

  function poseInto(progress: number, position: Vector3, target: Vector3) {
    const stop = clamp01(progress) * planetCount;
    const k = Math.round(stop);
    const offset = stop - k; // ∈ [-0.5, 0.5]
    let drift: number;
    if (Math.abs(offset) <= halfDwell) {
      // Parked: drift −1 → 1 across the window with cubic easing.
      position.copy(dwellPos[k]!);
      target.copy(dwellTgt[k]!);
      const local = (offset + halfDwell) / (2 * halfDwell);
      drift = (easeInOutCubic(local) * 2 - 1) * driftScale(k);
    } else {
      const from = offset > 0 ? k : k - 1;
      const t = clamp01((stop - (from + halfDwell)) / (1 - 2 * halfDwell));
      legInto(from, t, position, target);
      const startDrift = driftScale(from);
      const endDrift = -driftScale(from + 1);
      drift = startDrift + (endDrift - startDrift) * t;
    }
    if (drift === 0) return;
    // Drift sideways, perpendicular to the view, without moving the target.
    side.copy(target).sub(position).cross(UP).normalize();
    position.addScaledVector(side, drift * DWELL_DRIFT);
  }

  return {
    stops: dwells.length,
    dwells,
    legs: legs.map((l) => l.info),
    poseInto,
    poseAt(progress) {
      const p = new Vector3();
      const t = new Vector3();
      poseInto(progress, p, t);
      return { position: p.toArray() as Vec3, target: t.toArray() as Vec3 };
    },
  };
}
