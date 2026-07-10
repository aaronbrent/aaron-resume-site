import { describe, expect, it } from "vitest";
import { line3d } from "../../content/line3d";
import { contentAnchors } from "../line/anchors";
import { buildLineLut, emptyLineLutSample, sampleLineLut } from "../line/lut3d";
import { createNoise2D } from "./noise";
import { scatterTrees } from "./scatter";
import { buildTerrain, createTerrainBuilder } from "./terrain";

const lut = buildLineLut(line3d.points, contentAnchors());

describe("the deterministic world (PLAN-3D §3)", () => {
  it("noise is seeded: same seed same field, different seed different field", () => {
    const a = createNoise2D(7);
    const b = createNoise2D(7);
    const c = createNoise2D(8);
    expect(a(1.3, 4.2)).toBe(b(1.3, 4.2));
    expect(a(1.3, 4.2)).not.toBe(c(1.3, 4.2));
    const v = a(0.5, 0.5);
    expect(v).toBeGreaterThanOrEqual(-1);
    expect(v).toBeLessThanOrEqual(1);
  });

  it("terrain grooms the corridor flat at line elevation", () => {
    const terrain = buildTerrain(lut, line3d.seed, { cellM: 4 });
    const out = emptyLineLutSample();
    for (const t of [0.1, 0.45, 0.8]) {
      const s = sampleLineLut(lut, t, out);
      const ground = terrain.heightAt(s.pos[0], s.pos[2]);
      // Groomed 0.4 m below the line's baseline, within a cell of tolerance.
      expect(Math.abs(ground - (s.pos[1] - 0.4))).toBeLessThan(1.5);
    }
  });

  it("dwell benches widen the groomed apron", () => {
    const terrain = buildTerrain(lut, line3d.seed, { cellM: 4 });
    const out = emptyLineLutSample();
    // Walk outward until the ground leaves the groomed plane: the flat width
    // at a bench beats the flat width on a fast stretch.
    const groomedWidth = (t: number) => {
      const s = sampleLineLut(lut, t, out);
      const rx = s.tan[2];
      const rz = -s.tan[0];
      for (let d = 7; d <= 30; d += 0.5) {
        const g = terrain.heightAt(s.pos[0] + rx * d, s.pos[2] + rz * d);
        if (Math.abs(g - (s.pos[1] - 0.4)) > 0.5) return d;
      }
      return 30;
    };
    expect(groomedWidth(0.18)).toBeGreaterThan(groomedWidth(0.3) + 3);
  });

  it("terrain generation is deterministic from the seed", () => {
    const a = createTerrainBuilder(lut, line3d.seed, { cellM: 8 });
    a.fillRows(0, a.rows + 1);
    const b = createTerrainBuilder(lut, line3d.seed, { cellM: 8 });
    b.fillRows(0, b.rows + 1);
    expect(a.positions).toEqual(b.positions);
  });

  it("tree scatter is deterministic and clears the groomed corridor", () => {
    const a = scatterTrees(lut, line3d.seed, { count: 300 });
    const b = scatterTrees(lut, line3d.seed, { count: 300 });
    expect(a).toEqual(b);
    expect(a.length).toBeGreaterThan(200);
    // No tree stands within the widest groomed apron (corridor 7 + bench 8).
    for (const tree of a) {
      let best = Infinity;
      for (let i = 0; i < lut.n; i += 4) {
        const dx = lut.pos[i * 3]! - tree.x;
        const dz = lut.pos[i * 3 + 2]! - tree.z;
        best = Math.min(best, dx * dx + dz * dz);
      }
      expect(Math.sqrt(best)).toBeGreaterThan(15);
    }
  });
});
