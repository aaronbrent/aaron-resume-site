/**
 * Scene contract shared by W2a (scene + lighting), W2b (planets), and W3
 * (camera). World units: the sun's radius is 1; orbit radii and planet sizes
 * in app/content/planets.ts are in the same units. +y is up; orbits lie in
 * the y = 0 plane.
 */

export const SUN_RADIUS = 1;

/** Device-pixel-ratio ceiling for the canvas (mobile tuning, §6). */
export const DPR_MAX = 1.5;

/** Seed for the nebula + dust motes, so `?qa=1` renders are deterministic. */
export const NEBULA_SEED = 0x5eed;

/** `?qa=1`: fixed pose, paused animation, seeded nebula (visual regression). */
export const QA_PARAM = "qa";

export function isQaMode(search: string = globalThis.location?.search ?? ""): boolean {
  return new URLSearchParams(search).get(QA_PARAM) === "1";
}

/**
 * Seed for the star-system layout (system-layout.ts): planet bearings and
 * tilts, and every moon's orbit. Picked by eye from seeds that pass
 * checkLayout; `?seed=N` previews others.
 */
export const LAYOUT_SEED = 1;
