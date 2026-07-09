import { describe, expect, it } from "vitest";
import {
  deriveMotionChannels,
  deriveRiderPose,
  POSE_THRESHOLDS,
  type PoseSignals,
} from "./pose";

const neutral: PoseSignals = {
  t: 0.5,
  velocity: 0.2,
  curvature: 0,
  roll: 0,
  reverseMs: 0,
  decelerating: false,
};

describe("rider pose state machine (Phase 4)", () => {
  it("idles only while still at the summit", () => {
    expect(deriveRiderPose({ ...neutral, t: 0, velocity: 0 })).toBe("idle");
    expect(deriveRiderPose({ ...neutral, t: 0.1, velocity: 0 })).not.toBe("idle");
  });

  it("uses curvature sign for left and right carves", () => {
    expect(deriveRiderPose({ ...neutral, curvature: -POSE_THRESHOLDS.carveCurve })).toBe(
      "carve-left",
    );
    expect(deriveRiderPose({ ...neutral, curvature: POSE_THRESHOLDS.carveCurve })).toBe(
      "carve-right",
    );
  });

  it("tucks on a fast, low-curvature traverse", () => {
    expect(
      deriveRiderPose({
        ...neutral,
        velocity: POSE_THRESHOLDS.tuckVelocity,
        curvature: POSE_THRESHOLDS.tuckCurveMax,
      }),
    ).toBe("tuck");
  });

  it("uses the second-derivative channel for compression and unweighting", () => {
    expect(deriveRiderPose({ ...neutral, roll: POSE_THRESHOLDS.roller })).toBe(
      "compress",
    );
    expect(deriveRiderPose({ ...neutral, roll: -POSE_THRESHOLDS.roller })).toBe(
      "unweight",
    );
  });

  it("does not switch until reverse scroll passes the 150ms hysteresis", () => {
    expect(
      deriveRiderPose({
        ...neutral,
        velocity: -0.3,
        reverseMs: POSE_THRESHOLDS.reverseHysteresisMs - 1,
      }),
    ).not.toBe("switch");
    expect(
      deriveRiderPose({
        ...neutral,
        velocity: -0.3,
        reverseMs: POSE_THRESHOLDS.reverseHysteresisMs,
      }),
    ).toBe("switch");
  });

  it("brakes at the bottom when the run decelerates", () => {
    expect(
      deriveRiderPose({ ...neutral, t: POSE_THRESHOLDS.brakeT, decelerating: true }),
    ).toBe("brake");
  });

  it("caps continuous lean and crouch channels", () => {
    const channels = deriveMotionChannels({
      ...neutral,
      curvature: 10_000,
      roll: -10_000,
    });
    expect(channels.leanDeg).toBe(POSE_THRESHOLDS.maxLeanDeg);
    expect(channels.crouch).toBe(-1);
  });
});
