import type { PlanetVisual } from "~/content/types";
import type { Vec3 } from "../types";
import { BIOME_LOOK } from "./config";

export interface LabFraming {
  /** The planet's true world position. */
  planet: Vec3;
  /** Camera position: on the sun side, swung off the sun line so the terminator shows. */
  camera: Vec3;
  /** Direction (as a position, target = origin) for a camera-side fill light. */
  fill: Vec3;
}

/**
 * Close-up framing for the planet lab. The camera sits between the sun
 * (origin) and the planet, rotated `swing` radians about +y off the
 * planet→sun line and raised a little, at a distance that fits the planet
 * (and its rings) into ~70% of the frame height.
 */
export function labFraming(
  visual: Pick<PlanetVisual, "biome" | "size" | "hasRings">,
  planet: Vec3,
  fovDeg: number,
  aspect = 1.6,
  swing = 1.4,
): LabFraming {
  const look = BIOME_LOOK[visual.biome];
  const extent = visual.size * (visual.hasRings ? look.ring.outer : 1.6);
  const tanHalf = Math.tan((fovDeg * Math.PI) / 360);
  // fit ~72% of the frame height, and ~80% of the width on narrow tiles
  const dist = Math.max(extent / tanHalf / 0.72, extent / (tanHalf * aspect) / 0.8);
  // unit vector planet → sun, in the xz-plane
  const len = Math.hypot(planet[0], planet[2]) || 1;
  const sx = -planet[0] / len;
  const sz = -planet[2] / len;
  const c = Math.cos(swing);
  const s = Math.sin(swing);
  const dx = sx * c + sz * s;
  const dz = -sx * s + sz * c;
  const dy = 0.34;
  const n = Math.hypot(dx, dy, dz);
  const off: Vec3 = [(dx / n) * dist, (dy / n) * dist, (dz / n) * dist];
  return {
    planet,
    camera: [planet[0] + off[0], planet[1] + off[1], planet[2] + off[2]],
    fill: off,
  };
}
