import { describe, expect, it } from "vitest";
import { buildLut, sampleLut, smooth } from "./lut";

const deg = (rad: number) => (rad * 180) / Math.PI;

describe("buildLut against analytic curves (Phase 3 gate)", () => {
  it("straight 45° line: constant θ, zero curvature", () => {
    const pts: Array<[number, number]> = [];
    for (let i = 0; i <= 100; i++) pts.push([i * 10, i * 10]);
    const lut = buildLut(pts, 500);
    for (const t of [0.1, 0.5, 0.9]) {
      const s = sampleLut(lut, t);
      expect(deg(s.theta)).toBeCloseTo(45, 1);
      expect(s.dThetaDy).toBeCloseTo(0, 5);
    }
    // position: x == y on this line
    const s = sampleLut(lut, 0.5);
    expect(s.x).toBeCloseTo(s.y, 0);
  });

  it("circular arc: tangent and dθ/dy match the analytic circle", () => {
    // Quarter-ish arc of radius R, y-monotonic: x = R·sin(φ), y = R·(1−cos(φ))
    const R = 1000;
    const pts: Array<[number, number]> = [];
    for (let i = 0; i <= 400; i++) {
      const phi = (i / 400) * (Math.PI / 3); // 0..60°, dy/dφ > 0 throughout
      pts.push([R * Math.sin(phi), R * (1 - Math.cos(phi))]);
    }
    const lut = buildLut(pts, 1000);
    for (const t of [0.25, 0.5, 0.75]) {
      const s = sampleLut(lut, t);
      const phi = Math.acos(1 - s.y / R);
      // tangent direction: (cos φ, sin φ) → θ = atan2(sin φ, cos φ) = φ
      expect(s.theta).toBeCloseTo(phi, 2);
      // dθ/dy = dφ/dy = 1/(R·sin φ) — 20% relative tolerance: the derivative
      // carries discretization noise from the input polyline, and the pose
      // system consumes sign + magnitude scale, not exact curvature.
      const analytic = 1 / (R * Math.sin(phi));
      expect(Math.abs(s.dThetaDy - analytic) / analytic).toBeLessThan(0.2);
    }
  });

  it("S-curve: curvature changes sign at the inflection", () => {
    // x = A·sin(y·k): curvature sign flips at y = π/k
    const A = 300;
    const k = Math.PI / 1000;
    const pts: Array<[number, number]> = [];
    for (let i = 0; i <= 800; i++) {
      const y = i * 2.5; // 0..2000 → full S
      pts.push([A * Math.sin(y * k), y]);
    }
    const lut = buildLut(pts, 1000);
    const before = sampleLut(lut, 0.25); // y=500, first bend
    const after = sampleLut(lut, 0.75); // y=1500, second bend
    expect(Math.sign(before.dThetaDy)).not.toBe(Math.sign(after.dThetaDy));
  });

  it("sampleLut clamps t outside [0,1]", () => {
    const pts: Array<[number, number]> = [
      [0, 0],
      [100, 100],
    ];
    const lut = buildLut(pts, 100);
    expect(sampleLut(lut, -1).y).toBe(0);
    expect(sampleLut(lut, 2).y).toBe(100);
  });
});

describe("smoother", () => {
  it("is frame-rate independent: 1×100ms ≈ 10×10ms", () => {
    const one = smooth(0, 100, 100, 120);
    let many = 0;
    for (let i = 0; i < 10; i++) many = smooth(many, 100, 10, 120);
    expect(one).toBeCloseTo(many, 6);
  });

  it("converges monotonically toward the target", () => {
    let v = 0;
    let prev = 0;
    for (let i = 0; i < 50; i++) {
      v = smooth(v, 100, 16, 120);
      expect(v).toBeGreaterThan(prev);
      expect(v).toBeLessThanOrEqual(100);
      prev = v;
    }
    expect(v).toBeGreaterThan(95);
  });
});
