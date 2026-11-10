import { describe, expect, it } from "vitest";
import { mulberry32 } from "./random";

describe("mulberry32", () => {
  it("is deterministic for a seed", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const seqA = Array.from({ length: 8 }, a);
    expect(Array.from({ length: 8 }, b)).toEqual(seqA);
  });

  it("differs across seeds and stays in [0, 1)", () => {
    const a = Array.from({ length: 100 }, mulberry32(1));
    const b = Array.from({ length: 100 }, mulberry32(2));
    expect(a).not.toEqual(b);
    for (const v of [...a, ...b]) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});
