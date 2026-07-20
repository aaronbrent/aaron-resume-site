import type { LineLut } from "../line/lut3d.ts";
import { branchInfluence, type ForkBranch } from "./junctions.ts";
import { createNoise2D, fbm } from "./noise.ts";

/**
 * Deterministic treeline scatter (PLAN-3D §3, upgraded in Phase G): the woods
 * grow as clustered groves with glades between them, not uniform confetti —
 * a cluster center seeds a handful of trees that share a size bias, so each
 * grove reads as one stand. Height tapers toward the treeline near the
 * summit, and every tree carries its archetype, lean, and width so no two
 * neighbors render identically. Pure data — the rig turns placements into
 * instances, and the same seed always grows the same forest (SSR/CI/
 * screenshot stable).
 */

export interface TreePlacement {
  x: number;
  /** Ground height is the caller's job (terrain.heightAt) — z first, y after. */
  z: number;
  /** Overall tree height, meters. */
  heightM: number;
  /** Canopy lightness jitter ∈ [-1, 1] for instance color variation. */
  tint: number;
  /** Which merged spruce geometry this tree instances (0..TREE_ARCHETYPES). */
  archetype: number;
  /** Lean off vertical, radians — small, storm-bent. */
  lean: number;
  /** World-plane direction of the lean, radians. */
  leanDir: number;
  /** Canopy width multiplier (non-uniform scale vs height). */
  width: number;
}

export interface ScatterOptions {
  count?: number;
  /** Minimum lateral distance from the line, meters (clears bench aprons). */
  standoffM?: number;
  maxDistM?: number;
  /** Junction decoy trails no tree may stand on. */
  branches?: readonly ForkBranch[];
  /** How many geometry archetypes the renderer offers. */
  archetypes?: number;
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

const smoothstep = (edge0: number, edge1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

export function scatterTrees(
  lut: LineLut,
  seed: number,
  opts: ScatterOptions = {},
): TreePlacement[] {
  const count = opts.count ?? 2200;
  const standoff = opts.standoffM ?? 16;
  const maxDist = opts.maxDistM ?? 130;
  const branches = opts.branches ?? [];
  const archetypes = opts.archetypes ?? 4;
  const rand = mulberry32(seed ^ 0x51ab7e);
  const noise = createNoise2D(seed ^ 0x0dd5ea);
  const trees: TreePlacement[] = [];

  // The line's elevation span sets the treeline: groves thin and shrink as
  // they climb toward the summit's altitude.
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < lut.n; i++) {
    minY = Math.min(minY, lut.pos[i * 3 + 1]!);
    maxY = Math.max(maxY, lut.pos[i * 3 + 1]!);
  }
  const elevSpan = Math.max(1, maxY - minY);

  const clearOf = (x: number, z: number): boolean => {
    // Nothing grows on a groomed decoy trail (or its shoulders).
    if (branches.some((b) => branchInfluence(b, x, z, 5).weight > 0.05)) return false;
    // Cluster spread is only a proposal: verify true distance to the line so
    // no grove spills onto the corridor (and none drifts past the far edge).
    let nearest2 = Infinity;
    for (let j = 0; j < lut.n; j += 8) {
      const dx = lut.pos[j * 3]! - x;
      const dz = lut.pos[j * 3 + 2]! - z;
      const d2 = dx * dx + dz * dz;
      if (d2 < nearest2) nearest2 = d2;
    }
    return nearest2 >= standoff * standoff && nearest2 <= (maxDist + 30) ** 2;
  };

  const maxAttempts = count * 6;
  for (let i = 0; i < maxAttempts && trees.length < count; i++) {
    // Grove center: a point beside the run, gated by the forest-density
    // field so clearings and stands alternate at hillside scale.
    const row = Math.min(lut.n - 1, Math.floor(rand() * lut.n));
    const px = lut.pos[row * 3]!;
    const py = lut.pos[row * 3 + 1]!;
    const pz = lut.pos[row * 3 + 2]!;
    const rx = lut.tan[row * 3 + 2]!;
    const rz = -lut.tan[row * 3]!;
    const side = rand() < 0.5 ? -1 : 1;
    const dist = standoff + rand() * (maxDist - standoff);
    const cx = px + rx * dist * side;
    const cz = pz + rz * dist * side;
    if (fbm(noise, cx * 0.009, cz * 0.009, 2) < -0.12) continue;
    // Treeline: stands climbing toward the summit thin out, then stop.
    const elev = (py - minY) / elevSpan;
    if (rand() < smoothstep(0.72, 0.96, elev)) continue;
    const taper = 1 - 0.45 * smoothstep(0.55, 0.95, elev);

    // The grove: a shared size bias and a loose spread of trees around the
    // center, each still individually validated.
    const groveSize = 0.78 + rand() * 0.5;
    const groveN = 2 + Math.floor(rand() * 6);
    for (let k = 0; k < groveN && trees.length < count; k++) {
      const spread = 2.5 + rand() * 8.5;
      const angle = rand() * Math.PI * 2;
      const x = cx + Math.sin(angle) * spread;
      const z = cz + Math.cos(angle) * spread;
      // Fine-grain density inside the grove keeps its edge ragged.
      if (fbm(noise, x * 0.05, z * 0.05, 2) < -0.55) continue;
      if (!clearOf(x, z)) continue;
      trees.push({
        x,
        z,
        heightM: Math.max(1.9, (3.0 + rand() * 4.6) * groveSize * taper),
        tint: rand() * 2 - 1,
        archetype: Math.floor(rand() * archetypes),
        lean: rand() * rand() * 0.09,
        leanDir: rand() * Math.PI * 2,
        width: 0.82 + rand() * 0.42,
      });
    }
  }
  return trees;
}
