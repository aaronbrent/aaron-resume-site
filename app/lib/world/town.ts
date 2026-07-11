/**
 * The ski town (PLAN-3D ADR-9, amended): a deterministic village plan for the
 * valley basin below base camp — chalets ringing a church plaza, a handful of
 * outliers up the meadows. Pure data (like scatter.ts): the rig turns
 * placements into three instanced draws, and the same seed always builds the
 * same town, so CI screenshots stay stable.
 */

export interface Building {
  x: number;
  z: number;
  /** Footprint, meters: width along local x (gable side), depth along z. */
  w: number;
  d: number;
  /** Wall height, meters (the roof rises above this). */
  h: number;
  yaw: number;
  kind: "chalet" | "tower";
  /** Window-glow dial ∈ [0,1] — how many warm windows this building shows. */
  glow: number;
}

export interface TownPlan {
  center: { x: number; z: number };
  buildings: Building[];
}

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface TownOptions {
  chalets?: number;
  /** Plaza ellipse radii the village fills, meters. */
  radiusX?: number;
  radiusZ?: number;
  minSpacingM?: number;
}

export function planTown(
  seed: number,
  center: { x: number; z: number },
  opts: TownOptions = {},
): TownPlan {
  const rand = mulberry32(seed ^ 0x70b17);
  const chalets = opts.chalets ?? 34;
  const radiusX = opts.radiusX ?? 95;
  const radiusZ = opts.radiusZ ?? 120;
  const spacing = opts.minSpacingM ?? 11;

  const buildings: Building[] = [];
  // The church: a tower on the plaza and its nave alongside.
  buildings.push({
    x: center.x,
    z: center.z,
    w: 5,
    d: 5,
    h: 11,
    yaw: 0.1,
    kind: "tower",
    glow: 0.6,
  });
  buildings.push({
    x: center.x + 1.2,
    z: center.z + 7.5,
    w: 8,
    d: 13,
    h: 5,
    yaw: 0.1,
    kind: "chalet",
    glow: 0.5,
  });

  const maxAttempts = chalets * 30;
  for (let i = 0; i < maxAttempts && buildings.length < chalets + 2; i++) {
    // Ring-biased sampling: houses crowd the plaza, thin toward the meadows.
    const ring = 0.16 + 0.84 * Math.sqrt(rand());
    const angle = rand() * Math.PI * 2;
    const x = center.x + Math.cos(angle) * radiusX * ring * (0.75 + rand() * 0.25);
    const z = center.z + Math.sin(angle) * radiusZ * ring * (0.75 + rand() * 0.25);
    let clear = true;
    for (const b of buildings) {
      const dx = b.x - x;
      const dz = b.z - z;
      if (dx * dx + dz * dz < spacing * spacing) {
        clear = false;
        break;
      }
    }
    if (!clear) continue;
    // Chalets face the plaza, loosely — a village, not a grid.
    const toPlaza = Math.atan2(center.x - x, center.z - z);
    buildings.push({
      x,
      z,
      w: 5.5 + rand() * 3.5,
      d: 7 + rand() * 5,
      h: 3.4 + rand() * 1.4,
      yaw: toPlaza + (rand() - 0.5) * 0.9,
      kind: "chalet",
      glow: 0.35 + rand() * 0.65,
    });
  }
  return { center, buildings };
}
