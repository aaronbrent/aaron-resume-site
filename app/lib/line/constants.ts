/**
 * Line tunables (PLAN-3D §2, §8). One file, HUD-observable territory — tuning
 * is observation, not recompiling guesses (v1 pose-threshold discipline).
 */
export const LINE_LIMITS = {
  /** Full-speed stretches must read as riding, not traversing. Degrees. */
  minGradeDeg: 8,
  /** Steeper than this reads as falling. Degrees. */
  maxGradeDeg: 38,
  /** Dwell benches stay near-flat so slowing down is diegetic. Degrees. */
  benchMaxGradeDeg: 4.5,
  /** Speed multiplier at or below which a stretch counts as a dwell bench. */
  benchSpeed: 0.35,
  /** Speed multiplier at or above which the full-speed grade floor applies. */
  fullSpeed: 0.9,
  /** Comfort cap on lateral acceleration κ·v² at reference pace, m/s². */
  maxLateralAccel: 9,
  /** Reference full-run ride time at a natural scroll pace, seconds. */
  referenceRideSeconds: 90,
  /** Every sign's read zone must last at least this long at reference pace. */
  minDwellSeconds: 3.5,
  /** Monotonic-descent tolerance per LUT row, meters (authoring noise only). */
  uphillToleranceM: 0.02,
} as const;
