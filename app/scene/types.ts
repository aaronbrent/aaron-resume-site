import type { PlanetVisual } from "~/content/types";
import type { MoonSpec } from "./planets/config";

export type Vec3 = readonly [x: number, y: number, z: number];

/** Props every planet body component (W2b) accepts from the scene (W2a). */
export interface PlanetBodyProps {
  visual: PlanetVisual;
  /** World position, from the seeded system layout (system-layout.ts). */
  position: Vec3;
  /** This planet's seeded moon orbits (system-layout.ts); [] for none. */
  moons: readonly MoonSpec[];
  /** Deterministic render: freeze rotation, clouds, and moons. */
  qa: boolean;
}
