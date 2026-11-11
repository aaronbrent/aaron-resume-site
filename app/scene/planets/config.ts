/**
 * Pure planet tuning + math (no three.js imports) so it is unit-testable and
 * cheap to tweak. Everything visual that W5 might want to dial down for
 * mobile lives here: segment counts (`detail`), ring/atmosphere/moon specs.
 */
import type { Biome, PlanetVisual } from "~/content/types";

/** Shader branch per body kind (`#define PLANET_KIND`). */
export const KIND = {
  molten: 0,
  ocean: 1,
  desert: 2,
  "ice-ringed": 3,
  "gas-giant-banded": 4,
  cloud: 5,
  moon: 6,
} as const satisfies Record<Biome | "cloud" | "moon", number>;

/** `?qa=1`: every animated value is evaluated at this fixed time (seconds). */
export const QA_TIME = 6;

/**
 * Geometry detail multiplier. 1 = desktop (64×48 for the big planets);
 * W5 can pass 0.5–0.75 on mobile. Clamped to [0.25, 1.5].
 */
export const DEFAULT_DETAIL = 1;

export interface BiomeLook {
  /** Self-rotation, rad/s, about the tilted axis. */
  spin: number;
  /** Axial tilt (rad) about x, then z. */
  tilt: readonly [x: number, z: number];
  /** Thin additive atmosphere shell radius (× size); 0 = none. */
  atmosphereScale: number;
  /** Peak atmosphere glow before ATMOSPHERE_GAIN (materials.ts). */
  atmosphereStrength: number;
  /** Fresnel rim strength on the body. */
  rim: number;
  /** Diffuse terminator wrap (0 = Lambert, 0.5 = very soft). */
  wrap: number;
  /** Cloud shell (× size) and its spin (rad/s); null = no clouds. */
  clouds: { scale: number; spin: number } | null;
  /** Ring extent (× size) and tilt relative to the equator; used if hasRings. */
  ring: { inner: number; outer: number; tilt: number };
}

const DEFAULT_RING = { inner: 1.35, outer: 2.1, tilt: 0 } as const;

export const BIOME_LOOK: Record<Biome, BiomeLook> = {
  molten: {
    spin: 0.06,
    tilt: [0.18, 0.1],
    atmosphereScale: 1.07,
    atmosphereStrength: 0.4,
    rim: 0.55,
    wrap: 0.3,
    clouds: null,
    ring: DEFAULT_RING,
  },
  ocean: {
    spin: 0.05,
    tilt: [0.32, -0.12],
    atmosphereScale: 1.1,
    atmosphereStrength: 0.7,
    rim: 0.6,
    wrap: 0.32,
    clouds: { scale: 1.025, spin: 0.085 },
    ring: DEFAULT_RING,
  },
  desert: {
    spin: 0.045,
    tilt: [0.42, 0.22],
    atmosphereScale: 1.06,
    atmosphereStrength: 0.45,
    rim: 0.5,
    wrap: 0.3,
    clouds: null,
    ring: { inner: 1.45, outer: 1.95, tilt: 0.12 },
  },
  "ice-ringed": {
    spin: 0.04,
    tilt: [-0.32, -0.22],
    atmosphereScale: 1.07,
    atmosphereStrength: 0.6,
    rim: 0.7,
    wrap: 0.32,
    clouds: null,
    ring: { inner: 1.3, outer: 2.35, tilt: 0 },
  },
  "gas-giant-banded": {
    spin: 0.035,
    tilt: [0.1, 0.12],
    atmosphereScale: 1.05,
    atmosphereStrength: 0.5,
    rim: 0.5,
    wrap: 0.36,
    clouds: null,
    ring: DEFAULT_RING,
  },
};

export function clampDetail(detail: number): number {
  return Math.min(1.5, Math.max(0.25, Number.isFinite(detail) ? detail : 1));
}

/** Sphere [width, height] segments for a body of radius `size`. */
export function sphereSegments(size: number, detail = DEFAULT_DETAIL): [number, number] {
  const d = clampDetail(detail);
  const [w, h] = size >= 0.9 ? [64, 48] : size >= 0.3 ? [48, 36] : [24, 16];
  return [Math.max(12, Math.round(w * d)), Math.max(8, Math.round(h * d))];
}

/** Ring theta segments (radial bands are a shader, so one radial segment). */
export function ringSegments(detail = DEFAULT_DETAIL): number {
  return Math.max(32, Math.round(128 * clampDetail(detail)));
}

/**
 * Ring UV remap: RingGeometry ships planar UVs. We want u = radial position
 * (0 at the inner edge, 1 at the outer) and v = angle / 2π, so the shader can
 * draw concentric bands with alpha gaps from `u` alone.
 */
export function ringUv(
  x: number,
  y: number,
  inner: number,
  outer: number,
): [number, number] {
  const r = Math.hypot(x, y);
  const u = (r - inner) / (outer - inner);
  const a = Math.atan2(y, x);
  const v = (a < 0 ? a + Math.PI * 2 : a) / (Math.PI * 2);
  return [Math.min(1, Math.max(0, u)), v];
}

export interface MoonSpec {
  /** Moon radius in scene units. */
  radius: number;
  /** Orbit radius from the planet's center. */
  orbit: number;
  /** Orbit inclination (rad) about the x axis. */
  inclination: number;
  /** Longitude of the ascending node (rad) about y. */
  node: number;
  /** Angle at t = 0 (rad). */
  phase: number;
  /** Angular speed (rad/s). */
  speed: number;
  /** Per-moon noise seed. */
  seed: number;
}

/**
 * Small, inclined orbits outside any ring. Phases are chosen so that at
 * QA_TIME the moons sit beside (not behind) their planet from the lab camera.
 */
export function moonSpecs(
  visual: Pick<PlanetVisual, "biome" | "size" | "moonCount" | "hasRings">,
): MoonSpec[] {
  const look = BIOME_LOOK[visual.biome];
  const clearance = visual.hasRings ? look.ring.outer + 0.45 : 1.9;
  const specs: MoonSpec[] = [];
  for (let i = 0; i < visual.moonCount; i++) {
    specs.push({
      radius: visual.size * (i === 0 ? 0.19 : 0.13),
      orbit: visual.size * (clearance + i * 0.7),
      inclination: i === 0 ? 0.32 : -0.22,
      node: i === 0 ? 0.6 : 2.1,
      phase: i === 0 ? 2.6 : 4.4,
      speed: i === 0 ? 0.22 : 0.15,
      seed: 3.1 + i * 7.7,
    });
  }
  return specs;
}

/**
 * Moon offset from its planet's center at time `t`, written into `out`
 * (no allocation, safe to call from useFrame). The orbit is a circle in the
 * xz-plane (counter-clockwise seen from +y), tilted about x by the
 * inclination, then rotated about y by the node.
 */
export function moonOffset(
  spec: Pick<MoonSpec, "orbit" | "inclination" | "node" | "phase" | "speed">,
  t: number,
  out: { x: number; y: number; z: number },
): void {
  const a = spec.phase + spec.speed * t;
  const x0 = spec.orbit * Math.cos(a);
  const z0 = -spec.orbit * Math.sin(a);
  // tilt about x
  const ci = Math.cos(spec.inclination);
  const si = Math.sin(spec.inclination);
  const y1 = -z0 * si;
  const z1 = z0 * ci;
  // rotate about y
  const cn = Math.cos(spec.node);
  const sn = Math.sin(spec.node);
  out.x = x0 * cn + z1 * sn;
  out.y = y1;
  out.z = -x0 * sn + z1 * cn;
}
