import type { PlanetVisual } from "~/content/types";
import type { Vec3 } from "./types";

/**
 * A planet's fixed world position (planets never move, so camera dwell
 * points never drift): `orbitRadius` out from the sun at `orbitAngle`
 * (0 = +x, counter-clockwise seen from above, i.e. toward −z), `elevation`
 * above (+) or below (−) the sun's plane.
 */
export function planetPosition(
  visual: Pick<PlanetVisual, "orbitRadius" | "orbitAngle"> & { elevation?: number },
): Vec3 {
  const { orbitRadius: r, orbitAngle: a, elevation = 0 } = visual;
  return [r * Math.cos(a), elevation, -r * Math.sin(a)];
}
