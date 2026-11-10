import { CatmullRomCurve3, Vector3 } from "three";
import { clamp01, DWELL_FRACTION } from "~/lib/progress";
import { SUN_RADIUS } from "./constants";
import { planetPosition } from "./layout";
import type { Vec3 } from "./types";

/**
 * Camera choreography (docs/PLAN-STAR-SYSTEM.md §5), pure and unit-tested.
 *
 * Stops: 0 = hero (sun fills the frame), i + 1 = planet i. Progress maps to
 * stop space as `progress * planetCount`, matching app/lib/progress.ts. Each
 * stop has a dwell window (±DWELL_FRACTION/2 of a step) where the camera
 * parks with a small cubic-eased drift; between windows it travels linearly
 * along a Catmull-Rom curve that swoops up over a raised midpoint.
 */

export interface PathPlanet {
  visual: { orbitRadius: number; orbitAngle: number; size: number };
}

export interface CameraPose {
  position: Vec3;
  target: Vec3;
}

export interface CameraPathOptions {
  /** Portrait viewports put the planet in the top half (panel below). */
  portrait?: boolean;
}

const UP = new Vector3(0, 1, 0);

/** Where the camera parks for a planet, and what it looks at. */
export function dwellPose(planet: PathPlanet, opts: CameraPathOptions = {}): CameraPose {
  const p = new Vector3(...planetPosition(planet.visual));
  const s = planet.visual.size;
  const towardSun = p.clone().negate().normalize();
  // Sit on the sun side so the lit face is toward the camera, swung ~35°
  // off the sun line so the terminator reads as a soft rounded edge.
  const swing = towardSun.clone().applyAxisAngle(UP, 0.6);
  const distance = s * 4.2 + 1.2;
  const position = p
    .clone()
    .addScaledVector(swing, distance)
    .addScaledVector(UP, s * 1.1);
  // Aim off-center so the planet sits beside (landscape: right of) or above
  // (portrait) the text panel instead of under it.
  const view = p.clone().sub(position).normalize();
  const right = view.clone().cross(UP).normalize();
  const target = opts.portrait
    ? p.clone().addScaledVector(UP, -s * 1.3)
    : p.clone().addScaledVector(right, -s * 1.4);
  return { position: position.toArray() as Vec3, target: target.toArray() as Vec3 };
}

/** The hero pose: close on the sun, slightly above, sun filling the frame. */
export function heroPose(opts: CameraPathOptions = {}): CameraPose {
  const d = opts.portrait ? SUN_RADIUS * 5.2 : SUN_RADIUS * 3.6;
  return { position: [0, SUN_RADIUS * 0.6, d], target: [0, 0, 0] };
}

function midpoint(a: CameraPose, b: CameraPose, lift: number): CameraPose {
  const pa = new Vector3(...a.position);
  const pb = new Vector3(...b.position);
  const ta = new Vector3(...a.target);
  const tb = new Vector3(...b.target);
  const pos = pa.lerp(pb, 0.5).addScaledVector(UP, lift);
  const tgt = ta.lerp(tb, 0.5);
  return { position: pos.toArray() as Vec3, target: tgt.toArray() as Vec3 };
}

export function easeInOutCubic(x: number): number {
  return x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2;
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
}

/** Lateral drift (scene units) across a dwell window; keeps parked shots alive. */
const DWELL_DRIFT = 0.35;

export function buildCameraPath(
  planets: readonly PathPlanet[],
  opts: CameraPathOptions = {},
): CameraPath {
  const dwells = [heroPose(opts), ...planets.map((p) => dwellPose(p, opts))];
  // Knots: dwell, mid, dwell, mid, … dwell. Dwell k sits at knot 2k.
  const knots: CameraPose[] = [];
  dwells.forEach((d, k) => {
    if (k > 0) {
      const prev = dwells[k - 1]!;
      const gap = new Vector3(...prev.position).distanceTo(new Vector3(...d.position));
      knots.push(midpoint(prev, d, Math.min(6, gap * 0.25)));
    }
    knots.push(d);
  });
  const positions = new CatmullRomCurve3(
    knots.map((k) => new Vector3(...k.position)),
    false,
    "centripetal",
  );
  const targets = new CatmullRomCurve3(
    knots.map((k) => new Vector3(...k.target)),
    false,
    "centripetal",
  );
  const lastKnot = knots.length - 1;
  const planetCount = planets.length;
  const halfDwell = DWELL_FRACTION / 2; // in stop units
  const side = new Vector3();

  /** The hero and final shots are exact: no drift on the end stops. */
  const driftScale = (k: number) => (k === 0 || k === planetCount ? 0 : 1);

  /**
   * Stop-space position (0 … planetCount) → curve knot coordinate, plus a
   * lateral drift in [-1, 1] that is continuous across dwell and travel.
   */
  function knotAt(stop: number): { knot: number; drift: number } {
    const k = Math.round(stop);
    const offset = stop - k; // ∈ [-0.5, 0.5]
    if (Math.abs(offset) <= halfDwell) {
      // Parked: drift −1 → 1 across the window with cubic easing.
      const local = (offset + halfDwell) / (2 * halfDwell);
      return { knot: 2 * k, drift: (easeInOutCubic(local) * 2 - 1) * driftScale(k) };
    }
    // Travelling: linear from the end of one window to the start of the next.
    const from = offset > 0 ? k : k - 1;
    const local = clamp01((stop - (from + halfDwell)) / (1 - 2 * halfDwell));
    const startDrift = driftScale(from);
    const endDrift = -driftScale(from + 1);
    return {
      knot: 2 * from + 2 * local,
      drift: startDrift + (endDrift - startDrift) * local,
    };
  }

  function poseInto(progress: number, position: Vector3, target: Vector3) {
    const stop = clamp01(progress) * planetCount;
    const { knot, drift } = knotAt(stop);
    const t = knot / lastKnot;
    positions.getPoint(t, position);
    targets.getPoint(t, target);
    if (drift === 0) return;
    // Drift sideways, perpendicular to the view, without moving the target.
    side.copy(target).sub(position).cross(UP).normalize();
    position.addScaledVector(side, drift * DWELL_DRIFT);
  }

  return {
    stops: dwells.length,
    dwells,
    poseInto,
    poseAt(progress) {
      const p = new Vector3();
      const t = new Vector3();
      poseInto(progress, p, t);
      return { position: p.toArray() as Vec3, target: t.toArray() as Vec3 };
    },
  };
}
