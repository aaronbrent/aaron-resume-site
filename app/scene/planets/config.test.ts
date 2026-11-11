import { describe, expect, it } from "vitest";
import { planets } from "~/content/planets";
import {
  BIOME_LOOK,
  moonOffset,
  moonSpecs,
  ringSegments,
  ringUv,
  sphereSegments,
} from "./config";
import { labFraming } from "./lab-math";

describe("labFraming", () => {
  it("frames each planet from the sun side, swung off the sun line", () => {
    for (const { visual } of planets) {
      const f = labFraming(visual, 32);
      const toCam = f.fill;
      const toSun = f.planet.map((v) => -v) as [number, number, number];
      const dot = toCam[0] * toSun[0] + toCam[1] * toSun[1] + toCam[2] * toSun[2];
      // camera on the sun's hemisphere, but well off the sun line
      expect(dot).toBeGreaterThan(0);
      expect(dot / (Math.hypot(...toCam) * Math.hypot(...toSun))).toBeLessThan(0.5);
      // camera well outside the body and its rings
      expect(Math.hypot(...toCam)).toBeGreaterThan(visual.size * 4);
    }
  });
});

describe("ringUv", () => {
  it("maps the inner edge to u = 0 and the outer edge to u = 1", () => {
    expect(ringUv(1.3, 0, 1.3, 2.3)[0]).toBeCloseTo(0);
    expect(ringUv(0, 2.3, 1.3, 2.3)[0]).toBeCloseTo(1);
    expect(ringUv(-1.8, 0, 1.3, 2.3)[0]).toBeCloseTo(0.5);
  });

  it("maps the angle to v in [0, 1)", () => {
    expect(ringUv(2, 0, 1, 3)[1]).toBeCloseTo(0);
    expect(ringUv(0, 2, 1, 3)[1]).toBeCloseTo(0.25);
    expect(ringUv(-2, 0, 1, 3)[1]).toBeCloseTo(0.5);
    expect(ringUv(0, -2, 1, 3)[1]).toBeCloseTo(0.75);
  });

  it("clamps u for vertices just outside the ring", () => {
    expect(ringUv(0.5, 0, 1, 2)[0]).toBe(0);
    expect(ringUv(5, 0, 1, 2)[0]).toBe(1);
  });
});

describe("moonOffset", () => {
  const spec = { orbit: 2, inclination: 0.4, node: 1.1, phase: 0.3, speed: 0.5 };

  it("keeps the moon on a circle of the orbit radius", () => {
    const out = { x: 0, y: 0, z: 0 };
    for (let t = 0; t < 20; t += 1.7) {
      moonOffset(spec, t, out);
      expect(Math.hypot(out.x, out.y, out.z)).toBeCloseTo(2);
      expect(Math.abs(out.y)).toBeLessThanOrEqual(2 * Math.sin(0.4) + 1e-9);
    }
  });

  it("stays in the equatorial plane with zero inclination", () => {
    const out = { x: 0, y: 0, z: 0 };
    moonOffset({ ...spec, inclination: 0 }, 3, out);
    expect(out.y).toBeCloseTo(0);
  });

  it("is deterministic for a given time", () => {
    const a = { x: 0, y: 0, z: 0 };
    const b = { x: 0, y: 0, z: 0 };
    moonOffset(spec, 6, a);
    moonOffset(spec, 6, b);
    expect(a).toEqual(b);
  });
});

describe("moonSpecs", () => {
  it("creates one spec per moon, sized 0.12–0.2 × the planet, outside any ring", () => {
    for (const { visual } of planets) {
      const specs = moonSpecs(visual);
      expect(specs).toHaveLength(visual.moonCount);
      for (const m of specs) {
        expect(m.radius / visual.size).toBeGreaterThanOrEqual(0.12);
        expect(m.radius / visual.size).toBeLessThanOrEqual(0.2);
        const minOrbit = visual.hasRings
          ? BIOME_LOOK[visual.biome].ring.outer * visual.size
          : visual.size;
        expect(m.orbit - m.radius).toBeGreaterThan(minOrbit);
      }
    }
  });
});

describe("segments", () => {
  it("uses 64×48 for large planets at full detail and scales down", () => {
    expect(sphereSegments(1.35)).toEqual([64, 48]);
    expect(sphereSegments(1.35, 0.5)).toEqual([32, 24]);
    expect(sphereSegments(0.55)).toEqual([48, 36]);
    expect(sphereSegments(0.1)).toEqual([24, 16]);
    expect(ringSegments(0.1)).toBe(32);
  });
});
