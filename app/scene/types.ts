import type { PlanetVisual } from "~/content/types";

export type Vec3 = readonly [x: number, y: number, z: number];

/** Props every planet body component (W2b) accepts from the scene (W2a). */
export interface PlanetBodyProps {
  visual: PlanetVisual;
  /** World position — always `planetPosition(visual)`. */
  position: Vec3;
  /** Deterministic render: freeze rotation, clouds, and moons. */
  qa: boolean;
}
