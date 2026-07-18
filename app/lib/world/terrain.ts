import type { LineLut } from "../line/lut3d.ts";
import { branchInfluence, type ForkBranch } from "./junctions.ts";
import { createNoise2D, fbm } from "./noise.ts";

/**
 * Procedural heightfield (PLAN-3D §3): a corridor-carved mountain generated
 * from the line LUT and the content seed. Pure data — the caller turns it
 * into a BufferGeometry — so it stays unit-testable and can move to build
 * time if the init budget gate (Phase B) demands it.
 *
 * The builder fills row ranges on demand so the rig can slice generation
 * across frames: the init budget is load-bearing for the summit open (§6),
 * and one long task is exactly what the performance gate punishes.
 *
 * Height model per vertex: elevation of the nearest line row, plus valley
 * walls rising away from the corridor, plus fbm relief that fades to zero
 * inside the groomed corridor so the run itself stays clean.
 *
 * Past the run's end the mountain opens instead of walling off: the side
 * walls collapse and the ground eases down into a broad valley basin — the
 * flat that holds the ski town, with the vista (massif, ranges, sky) above
 * it. The basin is part of the same heightfield, so buildings and trees
 * placed by heightAt() sit on real ground.
 */

export interface TerrainData {
  /** (cols+1)·(rows+1)·3 world-space vertex positions. */
  positions: Float32Array;
  indices: Uint32Array;
  cols: number;
  rows: number;
}

export interface TerrainBuilder extends TerrainData {
  /** Fills vertex rows [rStart, rEnd) — call over the full range once. */
  fillRows(rStart: number, rEnd: number): void;
  /** Bilinear ground height at world (x, z); valid after rows are filled. */
  heightAt(x: number, z: number): number;
  minX: number;
  minZ: number;
  cellM: number;
}

export interface TerrainOptions {
  /** Grid cell size, meters. */
  cellM?: number;
  /** Lateral margin beyond the line's x extent, meters. */
  marginX?: number;
  /** Margin behind the summit, meters. */
  marginZ?: number;
  /** Margin beyond the base — deep enough to hold the valley basin. */
  marginZEndM?: number;
  corridorHalfWidthM?: number;
  corridorShoulderM?: number;
  /** How far below base camp the valley floor settles. */
  valleyDropM?: number;
  /** Down-valley distance over which the basin opens and bottoms out. */
  valleyMouthM?: number;
  /** Junction decoy trails to carve alongside the main corridor. */
  branches?: readonly ForkBranch[];
}

const smoothstep = (edge0: number, edge1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

export function createTerrainBuilder(
  lut: LineLut,
  seed: number,
  opts: TerrainOptions = {},
): TerrainBuilder {
  const cell = opts.cellM ?? 3;
  const marginX = opts.marginX ?? 140;
  const marginZ = opts.marginZ ?? 90;
  // The runtime town is centered 330 m past the runout and spans a 120 m
  // basin radius. Leave additional ground beyond its rotated footprints so
  // no chalet can overhang the heightfield's far edge.
  const marginZEnd = opts.marginZEndM ?? 480;
  const corridor = opts.corridorHalfWidthM ?? 7;
  const shoulder = opts.corridorShoulderM ?? 20;
  const valleyDrop = opts.valleyDropM ?? 68;
  const valleyMouth = opts.valleyMouthM ?? 300;
  const branches = opts.branches ?? [];
  const noise = createNoise2D(seed);

  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (let i = 0; i < lut.n; i++) {
    minX = Math.min(minX, lut.pos[i * 3]!);
    maxX = Math.max(maxX, lut.pos[i * 3]!);
    minZ = Math.min(minZ, lut.pos[i * 3 + 2]!);
    maxZ = Math.max(maxZ, lut.pos[i * 3 + 2]!);
  }
  const lineEndZ = maxZ;
  minX -= marginX;
  maxX += marginX;
  minZ -= marginZ;
  maxZ += marginZEnd;

  const cols = Math.ceil((maxX - minX) / cell);
  const rows = Math.ceil((maxZ - minZ) / cell);
  const positions = new Float32Array((cols + 1) * (rows + 1) * 3);

  const indices = new Uint32Array(cols * rows * 6);
  let k = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const a = r * (cols + 1) + c;
      const b = a + 1;
      const d = a + (cols + 1);
      const e = d + 1;
      indices[k++] = a;
      indices[k++] = d;
      indices[k++] = b;
      indices[k++] = b;
      indices[k++] = d;
      indices[k++] = e;
    }
  }

  // The authored line advances monotonically in z, so each grid row needs
  // only a local window of LUT rows for its nearest-line query.
  const zOf = (i: number) => lut.pos[i * 3 + 2]!;
  const endLineX = lut.pos[(lut.n - 1) * 3]!;

  function fillRows(rStart: number, rEnd: number): void {
    let cursor = 0;
    for (let r = rStart; r < Math.min(rEnd, rows + 1); r++) {
      const z = minZ + r * cell;
      while (cursor < lut.n - 1 && zOf(cursor + 1) < z) cursor++;
      const lo = Math.max(0, cursor - 96);
      const hi = Math.min(lut.n - 1, cursor + 96);
      for (let c = 0; c <= cols; c++) {
        const x = minX + c * cell;
        let bestD2 = Infinity;
        let bestI = cursor;
        for (let i = lo; i <= hi; i += 2) {
          const dx = lut.pos[i * 3]! - x;
          const dz = lut.pos[i * 3 + 2]! - z;
          const d2 = dx * dx + dz * dz;
          if (d2 < bestD2) {
            bestD2 = d2;
            bestI = i;
          }
        }
        // Past the line's end, distance to the end point would wall off the
        // valley mouth; measure from the runout's continuation ray instead,
        // so the corridor spills forward into the basin.
        const dist = z > lineEndZ ? Math.abs(x - endLineX) : Math.sqrt(bestD2);
        const lineY = lut.pos[bestI * 3 + 1]!;
        // Dwell benches groom a wider apron: where the profile slows for a
        // sign, the flat corridor widens so the sign stands on groomed snow.
        const apron = corridor + 8 * (1 - smoothstep(0.25, 0.8, lut.speed[bestI]!));
        // Valley walls: gentle rise away from the run, capped so far ridges
        // stay believable; relief fades out inside the corridor.
        const wall = Math.min(90, (dist / 45) ** 1.7 * 20);
        const relief = fbm(noise, x * 0.011, z * 0.011, 3) * 14;
        const outside = smoothstep(apron, apron + shoulder, dist);
        // The valley mouth: past the run's end the walls collapse and the
        // ground falls away into the town basin. The drop is concave —
        // steepest right at the brink, easing onto the floor — so the whole
        // bowl (and the village in it) is visible from the runout instead of
        // hiding behind its own rollover.
        const open = smoothstep(lineEndZ - 10, lineEndZ + valleyMouth, z);
        const u = Math.min(1, Math.max(0, (z - lineEndZ) / valleyMouth));
        const drop = valleyDrop * (1 - (1 - u) * (1 - u));
        let y =
          lineY -
          0.4 -
          drop +
          outside * (wall * (1 - open) + relief * (1 - 0.6 * open) + 0.4);
        // Junction decoys: cut each untaken trail's shelf into the hillside.
        for (const branch of branches) {
          const cut = branchInfluence(branch, x, z);
          if (cut.weight > 0) y += (cut.y - y) * cut.weight;
        }
        const idx = (r * (cols + 1) + c) * 3;
        positions[idx] = x;
        positions[idx + 1] = y;
        positions[idx + 2] = z;
      }
    }
  }

  function heightAt(x: number, z: number): number {
    const fc = Math.min(cols - 1, Math.max(0, (x - minX) / cell));
    const fr = Math.min(rows - 1, Math.max(0, (z - minZ) / cell));
    const c0 = Math.floor(fc);
    const r0 = Math.floor(fr);
    const tx = fc - c0;
    const tz = fr - r0;
    const y = (r: number, c: number) => positions[(r * (cols + 1) + c) * 3 + 1]!;
    const top = y(r0, c0) + tx * (y(r0, c0 + 1) - y(r0, c0));
    const bottom = y(r0 + 1, c0) + tx * (y(r0 + 1, c0 + 1) - y(r0 + 1, c0));
    return top + tz * (bottom - top);
  }

  return { positions, indices, cols, rows, fillRows, heightAt, minX, minZ, cellM: cell };
}

/** One-shot build — tests and any future build-time serialization. */
export function buildTerrain(
  lut: LineLut,
  seed: number,
  opts: TerrainOptions = {},
): TerrainBuilder {
  const builder = createTerrainBuilder(lut, seed, opts);
  builder.fillRows(0, builder.rows + 1);
  return builder;
}
