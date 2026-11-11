import { Vector3 } from "three";
import { planets as contentPlanets } from "~/content/planets";
import type { PlanetId, PlanetVisual } from "~/content/types";
import { buildCameraPath, MIN_SWEEP, SUN_KEEP_OUT, type PathPlanet } from "./camera-path";
import { LAYOUT_SEED } from "./constants";
import { bearingOf, type Orbit, orbitPosition } from "./layout";
import { keepOutRadius, type MoonSpec, moonSpecs } from "./planets/config";
import { hashSeed, mulberry32 } from "./random";
import type { Vec3 } from "./types";

/**
 * The seeded star-system layout (docs/PLAN-STAR-SYSTEM.md §4). Content fixes
 * each planet's orbit radius and size; this scatters the planets around the
 * sun on tilted orbits and gives each planet's moons their own orbits, all
 * from one seed, so a layout is reproducible (`?qa=1` snapshots) and
 * checked: generateLayout re-rolls until checkLayout passes.
 */

export interface PlacedPlanet extends PathPlanet {
  id: PlanetId;
  orbit: Orbit;
  moons: readonly MoonSpec[];
}

export interface SystemLayout {
  seed: number;
  planets: readonly PlacedPlanet[];
}

interface LayoutSource {
  id: PlanetId;
  visual: PlanetVisual;
}

const DEG = Math.PI / 180;

/** Rules a layout must satisfy (checkLayout); the generator's ranges sit inside them. */
export const LAYOUT_RULES = {
  /** Neighbouring planets at least this far apart (scene units). */
  minSpacing: 14,
  /** Bearing change between consecutive planets (rad). */
  minStep: 60 * DEG,
  maxStep: 150 * DEG,
  /** Largest bearing sector with no planet in it: they surround the sun. */
  maxEmptySector: 150 * DEG,
  /** Some planet above and some below the sun's plane, by at least this much. */
  minElevation: 1,
  /** Every leg slings at least MIN_SWEEP and at most this far round its body. */
  maxSweep: 210 * DEG,
} as const;

const TRIES = 500;

function placePlanets(
  source: readonly LayoutSource[],
  rand: () => number,
): { orbit: Orbit; position: Vec3 }[] {
  const between = (lo: number, hi: number) => lo + (hi - lo) * rand();
  const direction = rand() < 0.5 ? -1 : 1; // the tour's overall sense round the sun
  let bearing = between(0, Math.PI * 2);
  return source.map((p, i) => {
    if (i > 0) {
      const step = between(
        LAYOUT_RULES.minStep + 5 * DEG,
        LAYOUT_RULES.maxStep - 5 * DEG,
      );
      bearing += step * (rand() < 0.8 ? direction : -direction);
    }
    const inclination = between(4 * DEG, 14 * DEG) * (rand() < 0.5 ? -1 : 1);
    const node = between(0, Math.PI * 2);
    const orbit = { inclination, node, anomaly: bearing - node };
    return { orbit, position: orbitPosition(p.visual.orbitRadius, orbit) };
  });
}

/** Moons depend only on the planet and the seed, not on placement re-rolls. */
function moonsFor(p: LayoutSource, seed: number): MoonSpec[] {
  return moonSpecs(p.visual, (hashSeed(p.id) ^ seed) >>> 0);
}

/**
 * Deterministic layout for `seed`: draws placements until one passes
 * checkLayout (the draw sequence is seeded, so the result is too). Falls
 * back to the last draw if none passes, which the tests rule out for the
 * shipped seed and a wide seed range.
 */
export function generateLayout(
  seed: number = LAYOUT_SEED,
  source: readonly LayoutSource[] = contentPlanets,
): SystemLayout {
  const rand = mulberry32(seed);
  const moons = source.map((p) => moonsFor(p, seed));
  let layout: SystemLayout | null = null;
  for (let attempt = 0; attempt < TRIES; attempt++) {
    const placed = placePlanets(source, rand);
    layout = {
      seed,
      planets: source.map((p, i) => ({
        id: p.id,
        orbit: placed[i]!.orbit,
        position: placed[i]!.position,
        size: p.visual.size,
        keepOut: keepOutRadius(p.visual, moons[i]!),
        moons: moons[i]!,
      })),
    };
    if (checkLayout(layout).length === 0) return layout;
  }
  return layout!;
}

const v = (p: Vec3) => new Vector3(p[0], p[1], p[2]);

/** Cheap placement rules: spacing, bearings, elevations. */
function checkPlacement(layout: SystemLayout): string[] {
  const fails: string[] = [];
  const ps = layout.planets;
  const bearings = ps.map((p) => bearingOf(p.position));
  for (let i = 1; i < ps.length; i++) {
    const gap = v(ps[i]!.position).distanceTo(v(ps[i - 1]!.position));
    if (gap < LAYOUT_RULES.minSpacing)
      fails.push(`${ps[i]!.id}: ${gap.toFixed(1)} from neighbour`);
    let step = Math.abs(bearings[i]! - bearings[i - 1]!) % (Math.PI * 2);
    if (step > Math.PI) step = Math.PI * 2 - step;
    if (step < LAYOUT_RULES.minStep - 1e-9 || step > LAYOUT_RULES.maxStep + 1e-9)
      fails.push(`${ps[i]!.id}: bearing step ${(step / DEG).toFixed(0)}°`);
  }
  const sorted = bearings
    .map((b) => ((b % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2))
    .sort((a, b) => a - b);
  let empty = sorted[0]! + Math.PI * 2 - sorted[sorted.length - 1]!;
  for (let i = 1; i < sorted.length; i++)
    empty = Math.max(empty, sorted[i]! - sorted[i - 1]!);
  if (empty > LAYOUT_RULES.maxEmptySector)
    fails.push(`empty sector ${(empty / DEG).toFixed(0)}°`);
  const ys = ps.map((p) => p.position[1]);
  if (!ys.some((y) => y > LAYOUT_RULES.minElevation))
    fails.push("nothing above the plane");
  if (!ys.some((y) => y < -LAYOUT_RULES.minElevation))
    fails.push("nothing below the plane");
  return fails;
}

/** Samples per flight leg when checking clearances. */
const CLEARANCE_SAMPLES = 240;

/** Flight rules, for both landscape and portrait framing. */
function checkFlight(layout: SystemLayout): string[] {
  const fails: string[] = [];
  const ps = layout.planets;
  const centres = ps.map((p) => v(p.position));
  const pos = new Vector3();
  const tgt = new Vector3();
  for (const portrait of [false, true]) {
    const path = buildCameraPath(ps, { portrait });
    const tag = portrait ? "portrait" : "landscape";
    path.legs.forEach((leg, k) => {
      if (leg.sweep < MIN_SWEEP - 1e-6 || leg.sweep > LAYOUT_RULES.maxSweep)
        fails.push(`${tag} leg ${k}: sweep ${(leg.sweep / DEG).toFixed(0)}°`);
    });
    const n = ps.length;
    const total = CLEARANCE_SAMPLES * n;
    for (let i = 0; i <= total; i++) {
      path.poseInto(i / total, pos, tgt);
      if (pos.length() < SUN_KEEP_OUT) {
        fails.push(
          `${tag}: within ${pos.length().toFixed(2)} of the sun at ${(i / total).toFixed(3)}`,
        );
        break;
      }
      const hit = ps.findIndex(
        (p, j) => pos.distanceTo(centres[j]!) < Math.max(p.keepOut, p.size * 2),
      );
      if (hit >= 0) {
        fails.push(
          `${tag}: inside ${ps[hit]!.id}'s keep-out at ${(i / total).toFixed(3)}`,
        );
        break;
      }
    }
  }
  return fails;
}

/** Every rule a layout breaks (empty = valid). Cheap rules first. */
export function checkLayout(layout: SystemLayout): string[] {
  const fails = checkPlacement(layout);
  return fails.length ? fails : checkFlight(layout);
}

/** `?seed=N` previews another layout; anything else uses LAYOUT_SEED. */
export function layoutSeed(search: string = globalThis.location?.search ?? ""): number {
  const raw = new URLSearchParams(search).get("seed");
  if (raw === null || !/^\d{1,10}$/.test(raw)) return LAYOUT_SEED;
  return Number(raw) >>> 0;
}

let cached: SystemLayout | null = null;

/** The layout for the current URL's seed (memoized). */
export function getSystemLayout(search?: string): SystemLayout {
  const seed = layoutSeed(search);
  if (cached?.seed !== seed) cached = generateLayout(seed);
  return cached;
}
