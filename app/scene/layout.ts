import type { PlanetVisual } from "~/content/types";
import type { Vec3 } from "./types";

/**
 * A planet's fixed world position on its orbit (amendment C.4: planets do
 * not orbit, so camera dwell points never drift). Angle 0 is +x; positive
 * angles turn counter-clockwise seen from above (+y), i.e. toward −z.
 */
export function planetPosition(
  visual: Pick<PlanetVisual, "orbitRadius" | "orbitAngle">,
): Vec3 {
  const { orbitRadius: r, orbitAngle: a } = visual;
  return [r * Math.cos(a), 0, -r * Math.sin(a)];
}
