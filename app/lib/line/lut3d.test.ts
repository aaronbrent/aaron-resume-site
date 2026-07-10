import { describe, expect, it } from "vitest";
import { closedTrail } from "../../content/closed-trail";
import { line3d } from "../../content/line3d";
import { waypoints } from "../../content/waypoints";
import type { LinePoint } from "../../content/types";
import { contentAnchors } from "./anchors";
import { buildLineLut, emptyLineLutSample, sampleLineLut } from "./lut3d";
import { validateLine } from "./validate";

const deg = (rad: number) => (rad * 180) / Math.PI;

function straightChute(drop: number, run: number, n = 8): LinePoint[] {
  const pts: LinePoint[] = [];
  for (let i = 0; i <= n; i++) {
    const f = i / n;
    pts.push({ p: [0, drop * (1 - f), run * f] });
  }
  return pts;
}

describe("buildLineLut against analytic curves (PLAN-3D Phase A gate)", () => {
  it("straight chute: constant tangent, zero curvature, exact grade", () => {
    const lut = buildLineLut(straightChute(100, 200), [], 512);
    const out = emptyLineLutSample();
    for (const t of [0.1, 0.5, 0.9]) {
      const s = sampleLineLut(lut, t, out);
      expect(s.tan[0]).toBeCloseTo(0, 5);
      expect(s.tan[1]).toBeCloseTo(-100 / Math.hypot(100, 200), 3);
      expect(s.tan[2]).toBeCloseTo(200 / Math.hypot(100, 200), 3);
      expect(s.curvature).toBeCloseTo(0, 5);
      expect(deg(s.grade)).toBeCloseTo(deg(Math.atan2(100, 200)), 1);
    }
    expect(lut.length).toBeCloseTo(Math.hypot(100, 200), 0);
  });

  it("descending helix arc: signed horizontal curvature matches 1/R", () => {
    const R = 80;
    const pts: LinePoint[] = [];
    for (let i = 0; i <= 60; i++) {
      const phi = (i / 60) * (Math.PI / 2); // quarter turn
      pts.push({ p: [R - R * Math.cos(phi), -20 * (i / 60), R * Math.sin(phi)] });
    }
    const lut = buildLineLut(pts, [], 2048);
    const out = emptyLineLutSample();
    for (const t of [0.3, 0.5, 0.7]) {
      const s = sampleLineLut(lut, t, out);
      // Heading swings toward +x throughout → positive sign, magnitude 1/R.
      expect(s.curvature).toBeGreaterThan(0);
      expect(Math.abs(s.curvature - 1 / R) / (1 / R)).toBeLessThan(0.15);
    }
  });

  it("S-curve: curvature changes sign at the inflection", () => {
    const pts: LinePoint[] = [];
    for (let i = 0; i <= 80; i++) {
      const z = i * 5;
      pts.push({ p: [30 * Math.sin((z * Math.PI) / 200), -0.3 * z, z] });
    }
    const lut = buildLineLut(pts, [], 1024);
    const out = emptyLineLutSample();
    const first = sampleLineLut(lut, 0.25, out).curvature;
    const second = sampleLineLut(lut, 0.75, out).curvature;
    expect(Math.sign(first)).not.toBe(Math.sign(second));
  });

  it("speed profile reparameterizes ride time: slow half owns 2/3 of t", () => {
    // First 100m at speed 1, second 100m at speed 0.5 → time split 1:2.
    const pts: LinePoint[] = [
      { p: [0, 40, 0], speed: 1 },
      { p: [0, 30, 50], speed: 1 },
      { p: [0, 20, 100], speed: 1 },
      { p: [0, 10, 150], speed: 0.5 },
      { p: [0, 0, 200], speed: 0.5 },
    ];
    // With the speed lerp between control points the exact boundary shifts a
    // touch; the midpoint of the path must land well before t=0.5.
    const lut = buildLineLut(pts, [], 1024);
    const out = emptyLineLutSample();
    const atThird = sampleLineLut(lut, 1 / 3, out);
    expect(atThird.pos[2]).toBeGreaterThan(80);
    expect(atThird.pos[2]).toBeLessThan(120);
    const atHalf = sampleLineLut(lut, 0.5, out);
    expect(atHalf.pos[2]).toBeGreaterThan(120);
  });

  it("anchors pin a waypoint to its content t exactly", () => {
    const pts: LinePoint[] = [
      { p: [0, 100, 0] },
      { p: [0, 80, 60] },
      { p: [0, 60, 120], waypointId: "mid" },
      { p: [0, 40, 180] },
      { p: [0, 0, 240] },
    ];
    const lut = buildLineLut(pts, [{ id: "mid", t: 0.7 }], 2048);
    const out = emptyLineLutSample();
    const s = sampleLineLut(lut, 0.7, out);
    expect(s.pos[2]).toBeCloseTo(120, 0);
    expect(s.pos[1]).toBeCloseTo(60, 0);
  });

  it("rejects anchors that the ride would reach out of order", () => {
    const pts: LinePoint[] = [
      { p: [0, 100, 0] },
      { p: [0, 60, 100], waypointId: "b" },
      { p: [0, 30, 200], waypointId: "a" },
      { p: [0, 0, 300] },
    ];
    expect(() =>
      buildLineLut(pts, [
        { id: "a", t: 0.2 },
        { id: "b", t: 0.8 },
      ]),
    ).toThrow(/order/);
  });

  it("sampleLineLut clamps t outside [0,1] and is allocation-free", () => {
    const lut = buildLineLut(straightChute(50, 100), [], 256);
    const out = emptyLineLutSample();
    const low = sampleLineLut(lut, -1, out);
    expect(low.pos[2]).toBeCloseTo(0, 3);
    const high = sampleLineLut(lut, 2, out);
    expect(high).toBe(out); // same record, mutated in place
    expect(high.pos[2]).toBeCloseTo(100, 0);
  });
});

describe("the committed line (content gate, mirrors pnpm line:validate)", () => {
  it("passes every authoring rule with the real content anchors", () => {
    const result = validateLine(line3d.points, contentAnchors());
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
  });

  const linePoints: readonly LinePoint[] = line3d.points;

  it("anchors every waypoint and the closed trail on the line", () => {
    const ids = new Set(linePoints.map((p) => p.waypointId).filter(Boolean));
    for (const w of waypoints) expect(ids.has(w.id)).toBe(true);
    expect(ids.has(closedTrail.id)).toBe(true);
  });

  it("the camera reaches each sign at the section's scroll position", () => {
    const lut = buildLineLut(linePoints, contentAnchors());
    const out = emptyLineLutSample();
    for (const w of waypoints) {
      const anchored = linePoints.find((p) => p.waypointId === w.id)!;
      const s = sampleLineLut(lut, w.t, out);
      expect(s.pos[0]).toBeCloseTo(anchored.p[0], 0);
      expect(s.pos[1]).toBeCloseTo(anchored.p[1], 0);
      expect(s.pos[2]).toBeCloseTo(anchored.p[2], 0);
    }
  });
});
