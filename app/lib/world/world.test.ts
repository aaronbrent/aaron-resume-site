import { describe, expect, it } from "vitest";
import { line3d } from "../../content/line3d";
import { contentAnchors } from "../line/anchors";
import { buildLineLut, emptyLineLutSample, sampleLineLut } from "../line/lut3d";
import { createNoise2D } from "./noise";
import { scatterTrees } from "./scatter";
import { buildTerrain, createTerrainBuilder } from "./terrain";
import { planTown } from "./town";

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

  it("the valley basin opens past the runout: floor drops, walls collapse", () => {
    const terrain = buildTerrain(lut, line3d.seed, { cellM: 4 });
    const end = sampleLineLut(lut, 1, emptyLineLutSample());
    const endX = end.pos[0];
    const endZ = end.pos[2];
    const endY = end.pos[1];
    // The floor settles well below base camp…
    const floor = terrain.heightAt(endX, endZ + 300);
    expect(floor).toBeLessThan(endY - 40);
    // …and stays a basin across its width instead of climbing valley walls.
    const flank = terrain.heightAt(endX - 90, endZ + 300);
    expect(Math.abs(flank - floor)).toBeLessThan(25);
    // Upslope of the runout the walls still stand.
    const wall = terrain.heightAt(endX - 90, endZ - 200);
    const runout = terrain.heightAt(endX, endZ - 200);
    expect(wall - runout).toBeGreaterThan(30);
  });

  it("the town plan is deterministic, spaced, and sits in the basin ellipse", () => {
    const a = planTown(line3d.seed, { x: 68, z: 1540 });
    const b = planTown(line3d.seed, { x: 68, z: 1540 });
    expect(a).toEqual(b);
    expect(a.buildings.length).toBeGreaterThan(25);
    expect(a.buildings.some((building) => building.kind === "tower")).toBe(true);
    for (let i = 0; i < a.buildings.length; i++) {
      const p = a.buildings[i]!;
      expect(Math.abs(p.x - 68)).toBeLessThan(130);
      expect(Math.abs(p.z - 1540)).toBeLessThan(160);
      for (let j = i + 1; j < a.buildings.length; j++) {
        const q = a.buildings[j]!;
        expect(Math.hypot(p.x - q.x, p.z - q.z)).toBeGreaterThan(4);
      }
    }
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
