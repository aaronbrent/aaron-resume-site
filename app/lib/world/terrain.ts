import type { LineLut } from "../line/lut3d.ts";
import { createNoise2D, fbm } from "./noise.ts";

/**
 * Procedural heightfield (PLAN-3D §3): a corridor-carved mountain generated
 * from the line LUT and the content seed. Pure data — the caller turns it
 * into a BufferGeometry — so it stays unit-testable and can move to build
 * time if the init budget gate (Phase B) demands it.
 *
 * Height model per vertex: elevation of the nearest line row, plus valley
 * walls rising away from the corridor, plus fbm relief that fades to zero
 * inside the groomed corridor so the run itself stays clean.
 */

export interface TerrainData {
  /** (cols+1)·(rows+1)·3 world-space vertex positions. */
  positions: Float32Array;
  indices: Uint32Array;
  cols: number;
  rows: number;
}

export interface TerrainOptions {
  /** Grid cell size, meters. */
  cellM?: number;
  /** Lateral margin beyond the line's x extent, meters. */
  marginX?: number;
  /** Margin behind the summit / beyond the base, meters. */
  marginZ?: number;
  corridorHalfWidthM?: number;
  corridorShoulderM?: number;
}

const smoothstep = (edge0: number, edge1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

export function buildTerrain(
  lut: LineLut,
  seed: number,
  opts: TerrainOptions = {},
): TerrainData {
  const cell = opts.cellM ?? 3;
  const marginX = opts.marginX ?? 140;
  const marginZ = opts.marginZ ?? 90;
  const corridor = opts.corridorHalfWidthM ?? 7;
  const shoulder = opts.corridorShoulderM ?? 20;
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
  minX -= marginX;
  maxX += marginX;
  minZ -= marginZ;
  maxZ += marginZ;

  const cols = Math.ceil((maxX - minX) / cell);
  const rows = Math.ceil((maxZ - minZ) / cell);
  const positions = new Float32Array((cols + 1) * (rows + 1) * 3);

  // The authored line advances monotonically in z, so each grid row needs
  // only a local window of LUT rows for its nearest-line query.
  const zOf = (i: number) => lut.pos[i * 3 + 2]!;
  let cursor = 0;
  for (let r = 0; r <= rows; r++) {
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
      const dist = Math.sqrt(bestD2);
      const lineY = lut.pos[bestI * 3 + 1]!;
      // Valley walls: gentle rise away from the run, capped so far ridges
      // stay believable; relief fades out inside the corridor.
      const wall = Math.min(90, (dist / 45) ** 1.7 * 20);
      const relief = fbm(noise, x * 0.011, z * 0.011, 3) * 14;
      const outside = smoothstep(corridor, corridor + shoulder, dist);
      const idx = (r * (cols + 1) + c) * 3;
      positions[idx] = x;
      positions[idx + 1] = lineY - 0.4 + outside * (wall + relief + 0.4);
      positions[idx + 2] = z;
    }
  }

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

  return { positions, indices, cols, rows };
}
