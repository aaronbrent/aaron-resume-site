import { describe, expect, it } from "vitest";
import { deriveRunHeightSvh, waypointOffsetSvh } from "./run-height";

const meta = { introSvh: 100, dwellSvh: 160, outroSvh: 220 };

describe("deriveRunHeightSvh", () => {
  it("derives the PLAN §2 worked example: 100 + 4×160 + 220 = 960svh", () => {
    expect(deriveRunHeightSvh(meta, 4)).toBe(960);
  });

  it("adding a 5th waypoint adds exactly one DWELL", () => {
    expect(deriveRunHeightSvh(meta, 5) - deriveRunHeightSvh(meta, 4)).toBe(160);
  });

  it("rejects non-integer and negative waypoint counts", () => {
    expect(() => deriveRunHeightSvh(meta, -1)).toThrow();
    expect(() => deriveRunHeightSvh(meta, 2.5)).toThrow();
  });
});

describe("waypointOffsetSvh", () => {
  it("scales t linearly against the derived run height", () => {
    expect(waypointOffsetSvh(meta, 4, 0.5)).toBe(480);
  });

  it("rejects t outside (0, 1)", () => {
    expect(() => waypointOffsetSvh(meta, 4, 0)).toThrow();
    expect(() => waypointOffsetSvh(meta, 4, 1)).toThrow();
    expect(() => waypointOffsetSvh(meta, 4, 1.2)).toThrow();
  });
});
