import { describe, expect, it } from "vitest";
import { REVEAL_FULL, REVEAL_ZERO, revealAt } from "./panels";

describe("revealAt", () => {
  it("is fully shown through the dwell and hidden mid-travel", () => {
    expect(revealAt(2, 2)).toBe(1);
    expect(revealAt(2 + REVEAL_FULL, 2)).toBe(1);
    expect(revealAt(2 - REVEAL_FULL, 2)).toBe(1);
    expect(revealAt(2.35, 2)).toBeGreaterThan(0);
    expect(revealAt(2.35, 2)).toBeLessThan(1);
    // Mid-flight is clear: neither neighbour's card shows.
    expect(revealAt(2.5, 2)).toBe(0);
    expect(revealAt(2.5, 3)).toBe(0);
    expect(revealAt(2 + REVEAL_ZERO, 2)).toBe(0);
    expect(revealAt(4, 2)).toBe(0);
  });

  it("hands over between neighbours: one fades out as the next fades in", () => {
    expect(revealAt(1.5, 1)).toBeCloseTo(revealAt(1.5, 2));
  });
});
