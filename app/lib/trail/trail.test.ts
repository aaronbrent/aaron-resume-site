import { describe, expect, it } from "vitest";
import { trails } from "../../content/trails";
import { trailConfigs } from "./configs.ts";
import { generateTrail } from "./generate.ts";
import { RULES, samplePath, validateTrail } from "./validate.ts";

const trailMobile = trails.mobile;
const trailDesktop = trails.desktop;

describe("generated trails", () => {
  it.each([
    ["mobile", trailMobile],
    ["desktop", trailDesktop],
  ])("committed %s trail passes the §2 validator", (_bp, trail) => {
    const result = validateTrail(trail);
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it("regenerating from config reproduces the committed paths exactly", () => {
    expect(generateTrail(trailConfigs.mobile).d).toBe(trailMobile.d);
    expect(generateTrail(trailConfigs.desktop).d).toBe(trailDesktop.d);
  });

  it("markers sit at t × height with one per waypoint", () => {
    for (const trail of [trailMobile, trailDesktop]) {
      expect(trail.markers).toHaveLength(4);
      for (const m of trail.markers) {
        expect(m.y).toBeCloseTo(m.t * trail.viewBox[1], 0);
      }
    }
  });
});

describe("validator catches authoring violations", () => {
  const markers: never[] = [];

  it("rejects uphill (y reversal)", () => {
    const d = "M 500 0 C 550 100 600 200 650 300 C 700 250 750 200 800 150";
    const r = validateTrail({ d, viewBox: [1000, 300], markers });
    expect(r.ok).toBe(false);
    expect(r.errors.join()).toMatch(/not strictly increasing/);
  });

  it("rejects a near-horizontal traverse (< 30° from horizontal)", () => {
    // 900 units of x over 100 of y ≈ 6° from horizontal.
    const d = "M 50 0 C 350 33 650 66 950 100";
    const r = validateTrail({ d, viewBox: [1000, 100], markers });
    expect(r.ok).toBe(false);
    expect(r.errors.join()).toMatch(/too shallow/);
  });

  it("rejects x out of the [40, 960] margin", () => {
    const d = "M 950 0 C 970 100 990 200 990 300";
    const r = validateTrail({ d, viewBox: [1000, 300], markers });
    expect(r.ok).toBe(false);
    expect(r.errors.join()).toMatch(/x out of bounds/);
  });

  it("rejects a kink (curvature spike)", () => {
    // Sharp V: down-right then a hard reversal with straight control points.
    const d = "M 200 0 C 300 100 400 200 500 300 C 400 400 300 500 200 600";
    const r = validateTrail({ d, viewBox: [1000, 600], markers });
    expect(r.ok).toBe(false);
    expect(r.errors.join()).toMatch(/curvature spike/);
  });

  it("flags a marker that is off the line", () => {
    const trail = generateTrail(trailConfigs.desktop);
    const bad = {
      ...trail,
      markers: [{ ...trail.markers[0]!, x: trail.markers[0]!.x + 100 }],
    };
    const r = validateTrail(bad);
    expect(r.errors.join()).toMatch(/off the line/);
  });

  it("samplePath produces strictly increasing y for generated trails", () => {
    const pts = samplePath(trailMobile.d);
    for (let i = 1; i < pts.length; i++) {
      expect(pts[i]![1]).toBeGreaterThan(pts[i - 1]![1]);
    }
  });

  it("exposes the §2 rule constants", () => {
    expect(RULES.MIN_ANGLE_DEG).toBe(30);
    expect(RULES.X_MIN).toBe(40);
    expect(RULES.X_MAX).toBe(960);
  });
});
