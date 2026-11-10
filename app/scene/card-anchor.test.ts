import { describe, expect, it } from "vitest";
import { anchorCard, rectHitsCircle } from "./card-anchor";

const vp = { w: 1280, h: 720 };
const card = { w: 480, h: 420 };

describe("anchorCard", () => {
  it("floats left of a planet framed right of centre, centred on it", () => {
    const planet = { x: 920, y: 360, r: 150 };
    const a = anchorCard(planet, card, vp);
    expect(a.side).toBe("left");
    expect(a.x + card.w).toBeLessThanOrEqual(planet.x - planet.r);
    expect(a.y + card.h / 2).toBeCloseTo(360);
    expect(a.overlaps).toBe(false);
  });

  it("goes right when the planet is left of centre", () => {
    const a = anchorCard({ x: 300, y: 360, r: 120 }, card, vp);
    expect(a.side).toBe("right");
    expect(a.overlaps).toBe(false);
  });

  it("falls back to the roomier side, clamped, when neither side fits", () => {
    const a = anchorCard({ x: 700, y: 360, r: 250 }, card, vp);
    expect(a.side).toBe("left");
    expect(a.x).toBe(24);
    expect(a.overlaps).toBe(true);
  });

  it("stays inside the viewport vertically", () => {
    const top = anchorCard({ x: 920, y: 40, r: 80 }, card, vp);
    expect(top.y).toBeGreaterThanOrEqual(24);
    const bottom = anchorCard({ x: 920, y: 700, r: 80 }, card, vp);
    expect(bottom.y + card.h).toBeLessThanOrEqual(vp.h - 24);
  });

  it("reports an unavoidable overlap instead of hiding it", () => {
    const a = anchorCard({ x: 640, y: 360, r: 500 }, card, vp);
    expect(a.overlaps).toBe(true);
  });

  it("aims the connector from the card edge at the planet's rim", () => {
    const planet = { x: 920, y: 360, r: 150 };
    const a = anchorCard(planet, card, vp, { gap: 40 });
    expect(a.connector.x).toBe(card.w); // right edge, card-local
    expect(a.connector.length).toBeCloseTo(40);
    expect(a.connector.angle).toBeCloseTo(0);
  });
});

describe("rectHitsCircle", () => {
  it("detects overlap and clearance", () => {
    expect(rectHitsCircle({ x: 0, y: 0, w: 100, h: 100 }, { x: 150, y: 50, r: 60 })).toBe(
      true,
    );
    expect(rectHitsCircle({ x: 0, y: 0, w: 100, h: 100 }, { x: 170, y: 50, r: 60 })).toBe(
      false,
    );
  });
});
