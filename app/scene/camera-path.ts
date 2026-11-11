import { Vector3 } from "three";
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
 * parks with a small cubic-eased drift. Between windows each leg is:
 *
 *   pan    (first 30%): the camera holds and turns to look straight at the
 *          next planet's centre, out in the distance;
 *   dolly  (rest): it moves in on it along a straight line (no swoop);
 *   settle (last ~45% of the dolly): the aim eases off-centre so the
 *          planet slides beside the role card as the camera parks.
 */

export interface PathPlanet {
  visual: { orbitRadius: number; orbitAngle: number; elevation: number; size: number };
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

/**
 * Where the camera parks for a planet, and what it looks at. The camera
 * arrives along the straight line from `from` (the previous parked position)
 * and stops short of the planet, a touch above the line for a ¾ view.
 */
export function dwellPose(
  planet: PathPlanet,
  from: Vec3,
  opts: CameraPathOptions = {},
): CameraPose {
  const p = new Vector3(...planetPosition(planet.visual));
  const s = planet.visual.size;
  const approach = p
    .clone()
    .sub(new Vector3(...from))
    .normalize();
  // Portrait frames are narrow: pull back so moons and rings fit.
  const distance = (s * 4.2 + 1.2) * (opts.portrait ? 1.3 : 1);
  const position = p
    .clone()
    .addScaledVector(approach, -distance)
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

/** Share of each leg spent turning to face the next planet before moving. */
export const PAN_END = 0.3;
/**
 * Share of the dolly (from its end) spent easing the aim off-centre. Starts
 * just before the role card begins fading in (panels.ts
 * REVEAL_APPROACH_START), so the planet slides right as the card appears.
 */
const SETTLE = 0.45;

export function buildCameraPath(
  planets: readonly PathPlanet[],
  opts: CameraPathOptions = {},
): CameraPath {
  const dwells: CameraPose[] = [heroPose(opts)];
  for (const p of planets)
    dwells.push(dwellPose(p, dwells[dwells.length - 1]!.position, opts));

  const dwellPos = dwells.map((d) => new Vector3(...d.position));
  const dwellTgt = dwells.map((d) => new Vector3(...d.target));
  /** Leg k flies from dwell k to dwell k + 1, i.e. toward planet k. */
  const centres = planets.map((p) => new Vector3(...planetPosition(p.visual)));
  const planetCount = planets.length;
  const halfDwell = DWELL_FRACTION / 2; // in stop units

  // Scratch (allocation-free per frame).
  const side = new Vector3();
  const dirA = new Vector3();
  const dirB = new Vector3();

  /** The hero and final shots are exact: no drift on the end stops. */
  const driftScale = (k: number) => (k === 0 || k === planetCount ? 0 : 1);

  /** target = position + nlerp(a, b, w) · length */
  function aim(
    position: Vector3,
    a: Vector3,
    b: Vector3,
    w: number,
    length: number,
    out: Vector3,
  ) {
    out
      .copy(a)
      .multiplyScalar(1 - w)
      .addScaledVector(b, w)
      .normalize()
      .multiplyScalar(length)
      .add(position);
  }

  /** Pose on leg `k` (dwell k → dwell k + 1) at travel-local t ∈ [0, 1]. */
  function legInto(k: number, t: number, position: Vector3, target: Vector3) {
    const fromPos = dwellPos[k]!;
    const fromTgt = dwellTgt[k]!;
    const toPos = dwellPos[k + 1]!;
    const toTgt = dwellTgt[k + 1]!;
    const centre = centres[k]!;
    if (t <= PAN_END) {
      // Pan: hold position, swing the aim to the next planet's centre.
      const w = easeInOutCubic(t / PAN_END);
      position.copy(fromPos);
      dirA.copy(fromTgt).sub(fromPos);
      const lenA = dirA.length();
      dirA.normalize();
      dirB.copy(centre).sub(fromPos);
      const lenB = dirB.length();
      dirB.normalize();
      aim(position, dirA, dirB, w, lenA + (lenB - lenA) * w, target);
      return;
    }
    // Dolly: straight in, eased, tracking the planet.
    const u = (t - PAN_END) / (1 - PAN_END);
    position.lerpVectors(fromPos, toPos, easeInOutCubic(u));
    dirA.copy(centre).sub(position);
    const lenA = dirA.length();
    dirA.normalize();
    const w = u <= 1 - SETTLE ? 0 : easeInOutCubic((u - (1 - SETTLE)) / SETTLE);
    if (w === 0) {
      target.copy(position).addScaledVector(dirA, lenA);
      return;
    }
    // Settle: ease the aim off-centre to the parked framing.
    dirB.copy(toTgt).sub(position);
    const lenB = dirB.length();
    dirB.normalize();
    aim(position, dirA, dirB, w, lenA + (lenB - lenA) * w, target);
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
    poseInto,
    poseAt(progress) {
      const p = new Vector3();
      const t = new Vector3();
      poseInto(progress, p, t);
      return { position: p.toArray() as Vec3, target: t.toArray() as Vec3 };
    },
  };
}
