import { describe, expect, it } from "vitest";
import { clamp01, dwellRange, planetIndexAt } from "./progress";

describe("planetIndexAt", () => {
  it("is -1 at the hero and walks the planets in order", () => {
    expect(planetIndexAt(0, 5)).toBe(-1);
    expect(planetIndexAt(0.09, 5)).toBe(-1);
    expect(planetIndexAt(0.2, 5)).toBe(0);
    expect(planetIndexAt(0.4, 5)).toBe(1);
    expect(planetIndexAt(0.8, 5)).toBe(3);
    expect(planetIndexAt(1, 5)).toBe(4);
  });

  it("clamps out-of-range progress", () => {
    expect(planetIndexAt(-1, 5)).toBe(-1);
    expect(planetIndexAt(2, 5)).toBe(4);
  });
});

describe("dwellRange", () => {
  it("centers each planet on its stop and keeps dwells disjoint", () => {
    const ranges = [0, 1, 2, 3, 4].map((i) => dwellRange(i, 5));
    expect(ranges[0]!.center).toBeCloseTo(0.2);
    expect(ranges[4]!.center).toBeCloseTo(1);
    expect(ranges[4]!.end).toBe(1);
    for (let i = 1; i < ranges.length; i++) {
      expect(ranges[i]!.start).toBeGreaterThan(ranges[i - 1]!.end);
    }
    for (const r of ranges) expect(planetIndexAt(r.center, 5)).toBe(ranges.indexOf(r));
  });
});

describe("clamp01", () => {
  it("clamps to [0, 1]", () => {
    expect(clamp01(-0.5)).toBe(0);
    expect(clamp01(0.5)).toBe(0.5);
    expect(clamp01(1.5)).toBe(1);
  });
});
