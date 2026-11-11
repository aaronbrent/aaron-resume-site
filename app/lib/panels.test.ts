import { describe, expect, it } from "vitest";
import {
  REVEAL_APPROACH_START,
  REVEAL_DEPART_END,
  REVEAL_FULL,
  revealAt,
} from "./panels";

describe("revealAt", () => {
  it("is fully shown through the dwell", () => {
    expect(revealAt(2, 2)).toBe(1);
    expect(revealAt(2 - REVEAL_FULL, 2)).toBe(1);
    expect(revealAt(2 + REVEAL_FULL, 2)).toBe(1);
  });

  it("stays hidden through most of the approach, fading in only at the end", () => {
    expect(revealAt(1.5, 2)).toBe(0); // mid-flight
    expect(revealAt(2 - REVEAL_APPROACH_START, 2)).toBe(0);
    const late = revealAt(2 - (REVEAL_FULL + REVEAL_APPROACH_START) / 2, 2);
    expect(late).toBeGreaterThan(0);
    expect(late).toBeLessThan(1);
  });

  it("is gone soon after the camera leaves", () => {
    expect(revealAt(2 + REVEAL_DEPART_END, 2)).toBe(0);
    expect(revealAt(2.5, 2)).toBe(0);
    expect(REVEAL_DEPART_END - REVEAL_FULL).toBeLessThan(
      REVEAL_APPROACH_START - REVEAL_FULL,
    );
  });

  it("never shows two cards at once", () => {
    for (let stop = 0; stop <= 5; stop += 0.01) {
      const shown = [0, 1, 2, 3, 4, 5].filter((own) => revealAt(stop, own) > 0);
      expect(shown.length).toBeLessThanOrEqual(1);
    }
  });
});
