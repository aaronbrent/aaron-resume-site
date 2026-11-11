import type { Vec3 } from "./types";

/**
 * A planet's orbit: a circle of the content's `orbitRadius` around the sun,
 * tilted out of the y = 0 plane. Planets never move along it (the camera's
 * dwell points stay put); `anomaly` is where on the circle the planet sits.
 * The seeded generator in system-layout.ts picks these.
 */
export interface Orbit {
  /** Tilt of the orbit plane (rad) about x, before the node rotation. */
  inclination: number;
  /** Longitude of the ascending node (rad): the tilted plane's turn about y. */
  node: number;
  /** Angle along the orbit (rad) from the node; bearing ≈ anomaly + node. */
  anomaly: number;
}

/**
 * World position on an orbit. The circle starts in the y = 0 plane
 * (0 = +x, counter-clockwise seen from above, i.e. toward −z), is tilted
 * about x by the inclination, then turned about y by the node — the same
 * convention as moonOffset (planets/config.ts).
 */
export function orbitPosition(radius: number, orbit: Orbit): Vec3 {
  const { inclination: i, node: n, anomaly: a } = orbit;
  const x0 = radius * Math.cos(a);
  const z0 = -radius * Math.sin(a);
  const y1 = -z0 * Math.sin(i);
  const z1 = z0 * Math.cos(i);
  const cn = Math.cos(n);
  const sn = Math.sin(n);
  return [x0 * cn + z1 * sn, y1, -x0 * sn + z1 * cn];
}

/** Bearing of a world position around the sun (rad, 0 = +x, CCW from above). */
export function bearingOf(p: Vec3): number {
  return Math.atan2(-p[2], p[0]);
}
