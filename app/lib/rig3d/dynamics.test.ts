import { describe, expect, it } from "vitest";
import { line3d } from "~/content/line3d";
import { contentAnchors } from "~/lib/line/anchors";
import { buildLineLut, emptyLineLutSample, sampleLineLut } from "~/lib/line/lut3d";
import { deriveDynamics, DYNAMICS_LIMITS, emptyDynamics } from "./dynamics";

describe("camera dynamics (PLAN-3D §5/§8)", () => {
  it("rests at neutral when parked on a bench", () => {
    const out = deriveDynamics({ curvature: 0, grade: 0, speed: 0.25 }, emptyDynamics());
    expect(out.bankDeg).toBe(0);
    expect(out.boardYawDeg).toBe(0);
    expect(out.fovDeg).toBe(DYNAMICS_LIMITS.baseFovDeg);
    expect(out.eyeHeightM).toBeCloseTo(DYNAMICS_LIMITS.eyeHeightM, 5);
  });

  it("banks with the carve's sign and never past the comfort cap", () => {
    const left = deriveDynamics(
      { curvature: -0.05, grade: 0.3, speed: 1 },
      emptyDynamics(),
    );
    const right = deriveDynamics(
      { curvature: 0.05, grade: 0.3, speed: 1 },
      emptyDynamics(),
    );
    expect(left.bankDeg).toBeLessThan(0);
    expect(right.bankDeg).toBeGreaterThan(0);
    expect(Math.abs(left.bankDeg)).toBeLessThanOrEqual(DYNAMICS_LIMITS.maxBankDeg);
    const extreme = deriveDynamics(
      { curvature: 10, grade: 0.3, speed: 1 },
      emptyDynamics(),
    );
    expect(extreme.bankDeg).toBeLessThanOrEqual(DYNAMICS_LIMITS.maxBankDeg);
    expect(extreme.bankDeg).toBeGreaterThan(DYNAMICS_LIMITS.maxBankDeg * 0.95);
  });

  it("speed widens the lens inside the 13° swing and deepens the tuck", () => {
    const slow = deriveDynamics(
      { curvature: 0, grade: 0.35, speed: 0.3 },
      emptyDynamics(),
    );
    const fast = deriveDynamics({ curvature: 0, grade: 0.35, speed: 1 }, emptyDynamics());
    expect(fast.fovDeg).toBeGreaterThan(slow.fovDeg);
    expect(fast.fovDeg).toBeLessThanOrEqual(DYNAMICS_LIMITS.maxFovDeg);
    expect(fast.eyeHeightM).toBeLessThan(slow.eyeHeightM);
    expect(fast.eyeHeightM).toBeGreaterThanOrEqual(
      DYNAMICS_LIMITS.eyeHeightM - DYNAMICS_LIMITS.maxCrouchM,
    );
    expect(fast.lookAheadT).toBeGreaterThan(slow.lookAheadT);
    expect(fast.lookAheadT).toBeLessThanOrEqual(DYNAMICS_LIMITS.maxLookAheadT);
  });

  it("holds every cap across the real authored line", () => {
    const lut = buildLineLut(line3d.points, contentAnchors());
    const sample = emptyLineLutSample();
    const out = emptyDynamics();
    for (let i = 0; i <= 500; i++) {
      deriveDynamics(sampleLineLut(lut, i / 500, sample), out);
      expect(Math.abs(out.bankDeg)).toBeLessThanOrEqual(DYNAMICS_LIMITS.maxBankDeg);
      expect(out.fovDeg).toBeGreaterThanOrEqual(DYNAMICS_LIMITS.baseFovDeg);
      expect(out.fovDeg).toBeLessThanOrEqual(DYNAMICS_LIMITS.maxFovDeg);
      expect(out.eyeHeightM).toBeGreaterThan(1.3);
      expect(Number.isFinite(out.lookAheadT)).toBe(true);
    }
  });

  it("shrugs off non-finite input instead of poisoning the camera", () => {
    const out = deriveDynamics(
      { curvature: NaN, grade: Infinity, speed: NaN },
      emptyDynamics(),
    );
    expect(out.bankDeg).toBe(0);
    expect(Number.isFinite(out.fovDeg)).toBe(true);
    expect(Number.isFinite(out.eyeHeightM)).toBe(true);
  });
});
