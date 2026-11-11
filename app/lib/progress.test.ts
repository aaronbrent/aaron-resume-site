import { describe, expect, it } from "vitest";
import {
  clamp01,
  dwellRange,
  planetIndexAt,
  stopAt,
  stopScrollPositions,
} from "./progress";

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

describe("stopScrollPositions", () => {
  it("parks each section top at the viewport top; the hero is always at 0", () => {
    const boxes = [0, 800, 1600, 2400, 3200, 4000].map((top) => ({ top }));
    expect(stopScrollPositions(boxes, 4400)).toEqual([0, 800, 1600, 2400, 3200, 4000]);
  });

  it("clamps to the scroll range and never goes backwards", () => {
    expect(stopScrollPositions([{ top: 5 }, { top: 700 }, { top: 1900 }], 1800)).toEqual([
      0, 700, 1800,
    ]);
    expect(stopScrollPositions([{ top: 0 }, { top: 900 }, { top: 800 }], 2000)).toEqual([
      0, 900, 900,
    ]);
  });
});

describe("stopAt", () => {
  const ys = [0, 800, 1600, 2400];
  it("interpolates between stop positions", () => {
    expect(stopAt(0, ys)).toBe(0);
    expect(stopAt(400, ys)).toBeCloseTo(0.5);
    expect(stopAt(1600, ys)).toBe(2);
    expect(stopAt(2000, ys)).toBeCloseTo(2.5);
  });
  it("holds at the last stop past the end (footer)", () => {
    expect(stopAt(5000, ys)).toBe(3);
  });
  it("handles coincident stops", () => {
    expect(stopAt(800, [0, 800, 800])).toBe(1);
  });
});
