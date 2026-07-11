import type { LineLut } from "../line/lut3d.ts";
import { branchInfluence, type ForkBranch } from "./junctions.ts";
import { createNoise2D, fbm } from "./noise.ts";

/**
 * Deterministic treeline scatter (PLAN-3D §3): forest patches beside the run,
 * kept off the groomed corridor and thinned by noise so the woods read as
 * woods, not confetti. Pure data — the rig turns placements into instances,
 * and the same seed always grows the same forest (SSR/CI/screenshot stable).
 */

export interface TreePlacement {
  x: number;
  /** Ground height is the caller's job (terrain.heightAt) — z first, y after. */
  z: number;
  /** Overall tree height, meters. */
  heightM: number;
  /** Canopy lightness jitter ∈ [-1, 1] for instance color variation. */
  tint: number;
}

export interface ScatterOptions {
  count?: number;
  /** Minimum lateral distance from the line, meters (clears bench aprons). */
  standoffM?: number;
  maxDistM?: number;
  /** Junction decoy trails no tree may stand on. */
  branches?: readonly ForkBranch[];
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

export function scatterTrees(
  lut: LineLut,
  seed: number,
  opts: ScatterOptions = {},
): TreePlacement[] {
  const count = opts.count ?? 1800;
  const standoff = opts.standoffM ?? 16;
  const maxDist = opts.maxDistM ?? 130;
  const branches = opts.branches ?? [];
  const rand = mulberry32(seed ^ 0x51ab7e);
  const noise = createNoise2D(seed ^ 0x0dd5ea);
  const trees: TreePlacement[] = [];
  const maxAttempts = count * 6;
  for (let i = 0; i < maxAttempts && trees.length < count; i++) {
    const row = Math.min(lut.n - 1, Math.floor(rand() * lut.n));
    const px = lut.pos[row * 3]!;
    const pz = lut.pos[row * 3 + 2]!;
    // Perpendicular offset from the local heading, either side of the run.
    const rx = lut.tan[row * 3 + 2]!;
    const rz = -lut.tan[row * 3]!;
    const side = rand() < 0.5 ? -1 : 1;
    const dist = standoff + rand() * (maxDist - standoff);
    const along = (rand() - 0.5) * 24;
    const x = px + rx * dist * side + lut.tan[row * 3]! * along;
    const z = pz + rz * dist * side + lut.tan[row * 3 + 2]! * along;
    // Forest patches: the noise field gates density so clearings exist.
    if (fbm(noise, x * 0.014, z * 0.014, 2) < 0.02) continue;
    // Nothing grows on a groomed decoy trail (or its shoulders).
    if (branches.some((b) => branchInfluence(b, x, z, 5).weight > 0.05)) continue;
    // The local-frame offset above is only a proposal: on the inside of a
    // carve it underestimates clearance, so verify true distance to the line.
    let nearest2 = Infinity;
    for (let j = 0; j < lut.n; j += 8) {
      const dx = lut.pos[j * 3]! - x;
      const dz = lut.pos[j * 3 + 2]! - z;
      const d2 = dx * dx + dz * dz;
      if (d2 < nearest2) nearest2 = d2;
    }
    if (nearest2 < standoff * standoff) continue;
    trees.push({
      x,
      z,
      heightM: 3.2 + rand() * 3.4,
      tint: rand() * 2 - 1,
    });
  }
  return trees;
}
