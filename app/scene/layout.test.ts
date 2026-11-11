import { describe, expect, it } from "vitest";
import { planets } from "~/content/planets";
import { LAYOUT_SEED } from "./constants";
import { bearingOf, orbitPosition } from "./layout";
import {
  checkLayout,
  generateLayout,
  getSystemLayout,
  LAYOUT_RULES,
  layoutSeed,
} from "./system-layout";

const DEG = Math.PI / 180;

describe("orbitPosition", () => {
  it("maps anomaly 0 to +x and 90° to −z on an untilted orbit", () => {
    const flat = { inclination: 0, node: 0 };
    const [x0, y0, z0] = orbitPosition(2, { ...flat, anomaly: 0 });
    expect([x0, y0, z0].map((c) => +c.toFixed(9))).toEqual([2, 0, 0]);
    const [x1, , z1] = orbitPosition(2, { ...flat, anomaly: Math.PI / 2 });
    expect(x1).toBeCloseTo(0);
    expect(z1).toBeCloseTo(-2);
  });

  it("keeps the radius, puts the bearing near anomaly + node, and lifts by the tilt", () => {
    const orbit = { inclination: 10 * DEG, node: 1.1, anomaly: 0.7 };
    const p = orbitPosition(30, orbit);
    expect(Math.hypot(...p)).toBeCloseTo(30);
    expect(bearingOf(p)).toBeCloseTo(1.8, 1); // tilt foreshortens it slightly
    expect(p[1]).toBeCloseTo(30 * Math.sin(0.7) * Math.sin(10 * DEG));
  });
});

describe("system layout", () => {
  const layout = generateLayout(LAYOUT_SEED);

  it("passes every layout rule for the shipped seed", () => {
    expect(checkLayout(layout)).toEqual([]);
  });

  it("is deterministic per seed, and other seeds give other layouts", () => {
    expect(generateLayout(LAYOUT_SEED)).toEqual(layout);
    expect(generateLayout(LAYOUT_SEED + 1).planets[0]!.position).not.toEqual(
      layout.planets[0]!.position,
    );
  });

  it("keeps content order, orbit radii and sizes", () => {
    layout.planets.forEach((p, i) => {
      const content = planets[i]!;
      expect(p.id).toBe(content.id);
      expect(p.size).toBe(content.visual.size);
      expect(Math.hypot(...p.position)).toBeCloseTo(content.visual.orbitRadius);
      expect(p.moons).toHaveLength(content.visual.moonCount);
      expect(p.keepOut).toBeGreaterThanOrEqual(p.size);
    });
  });

  it("surrounds the sun: no wide empty sector, planets above and below the plane", () => {
    const bearings = layout.planets
      .map((p) => ((bearingOf(p.position) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI))
      .sort((a, b) => a - b);
    let empty = bearings[0]! + 2 * Math.PI - bearings[bearings.length - 1]!;
    for (let i = 1; i < bearings.length; i++)
      empty = Math.max(empty, bearings[i]! - bearings[i - 1]!);
    expect(empty).toBeLessThanOrEqual(LAYOUT_RULES.maxEmptySector);
    const ys = layout.planets.map((p) => p.position[1]);
    expect(Math.max(...ys)).toBeGreaterThan(1);
    expect(Math.min(...ys)).toBeLessThan(-1);
    for (const p of layout.planets) {
      expect(Math.abs(p.position[1])).toBeLessThanOrEqual(
        Math.hypot(...p.position) * 0.25,
      );
    }
  });

  it("spaces neighbouring planets well apart", () => {
    for (let i = 1; i < layout.planets.length; i++) {
      const a = layout.planets[i - 1]!.position;
      const b = layout.planets[i]!.position;
      expect(Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])).toBeGreaterThan(
        LAYOUT_RULES.minSpacing,
      );
    }
  });

  it("finds a valid layout for any preview seed (?seed=1…200)", () => {
    const failing: number[] = [];
    for (let seed = 1; seed <= 200; seed++) {
      if (checkLayout(generateLayout(seed)).length) failing.push(seed);
    }
    expect(failing).toEqual([]);
  });
});

describe("layoutSeed", () => {
  it("reads ?seed=N and ignores anything else", () => {
    expect(layoutSeed("?seed=42")).toBe(42);
    expect(layoutSeed("?qa=1&seed=7")).toBe(7);
    expect(layoutSeed("")).toBe(LAYOUT_SEED);
    expect(layoutSeed("?seed=abc")).toBe(LAYOUT_SEED);
    expect(layoutSeed("?seed=-3")).toBe(LAYOUT_SEED);
  });

  it("memoizes the layout per seed", () => {
    expect(getSystemLayout("?seed=9")).toBe(getSystemLayout("?seed=9"));
    expect(getSystemLayout("?seed=9").seed).toBe(9);
  });
});
