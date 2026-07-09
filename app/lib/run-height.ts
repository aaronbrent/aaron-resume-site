/**
 * Scroll height derivation (PLAN §2). Never magic:
 *   runHeight = INTRO + waypoints × DWELL + OUTRO   (in svh units)
 * Adding a waypoint makes the page exactly one DWELL taller.
 */
export interface RunHeightMeta {
  introSvh: number;
  dwellSvh: number;
  outroSvh: number;
}

export function deriveRunHeightSvh(meta: RunHeightMeta, waypointCount: number): number {
  if (!Number.isInteger(waypointCount) || waypointCount < 0) {
    throw new Error(`waypointCount must be a non-negative integer, got ${waypointCount}`);
  }
  return meta.introSvh + waypointCount * meta.dwellSvh + meta.outroSvh;
}

/**
 * Document offset (in svh from the top of the run) for a waypoint at
 * normalized position t ∈ (0, 1). Positions both the SVG marker and the
 * content section — pure data, computable at build time.
 */
export function waypointOffsetSvh(
  meta: RunHeightMeta,
  waypointCount: number,
  t: number,
): number {
  if (t <= 0 || t >= 1) {
    throw new Error(`waypoint t must be in (0, 1), got ${t}`);
  }
  return t * deriveRunHeightSvh(meta, waypointCount);
}
