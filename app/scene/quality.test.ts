import { describe, expect, it } from "vitest";
import { FpsGovernor, forcedTier, initialTier, MIN_FPS, TIERS } from "./quality";

const desktop = { devicePixelRatio: 1, width: 1440, height: 900, coarsePointer: false };

describe("initialTier", () => {
  it("starts desktops at the top tier", () => {
    expect(initialTier(desktop)).toBe(2);
  });
  it("starts phones and huge pixel counts a tier lower", () => {
    expect(initialTier({ ...desktop, coarsePointer: true })).toBe(1);
    expect(
      initialTier({ ...desktop, devicePixelRatio: 2, width: 2560, height: 1440 }),
    ).toBe(1);
  });
  it("starts 2-core devices at the bottom tier", () => {
    expect(initialTier({ ...desktop, cores: 2 })).toBe(0);
  });
});

describe("forcedTier", () => {
  it("pins qa to the top tier and honours ?tier", () => {
    expect(forcedTier("?qa=1")).toBe(2);
    expect(forcedTier("?tier=0&qa=1")).toBe(0);
    expect(forcedTier("?gl=full")).toBeNull();
    expect(forcedTier("?tier=9")).toBeNull();
  });
});

describe("TIERS", () => {
  it("only ever gets cheaper going down", () => {
    expect(TIERS[1].dprMax).toBeLessThanOrEqual(TIERS[2].dprMax);
    expect(TIERS[0].dprMax).toBeLessThanOrEqual(TIERS[1].dprMax);
    expect(TIERS[0].detail).toBeLessThan(TIERS[1].detail);
    expect(TIERS[1].detail).toBeLessThan(TIERS[2].detail);
    expect(TIERS[0].dust).toBeLessThan(TIERS[2].dust);
  });
});

describe("FpsGovernor", () => {
  const run = (g: FpsGovernor, fps: number, seconds: number) => {
    let tripped = false;
    for (let t = 0; t < seconds; t += 1 / fps) tripped = g.sample(1 / fps) || tripped;
    return tripped;
  };
  it("holds at a healthy frame rate", () => {
    expect(run(new FpsGovernor(), 60, 10)).toBe(false);
  });
  it("trips after the warm-up when the frame rate is low", () => {
    const g = new FpsGovernor(1.5, 2);
    expect(run(g, MIN_FPS - 15, 1.4)).toBe(false); // still warming up
    expect(run(g, MIN_FPS - 15, 3)).toBe(true);
  });
  it("ignores background-tab stalls", () => {
    const g = new FpsGovernor(0, 2);
    for (let i = 0; i < 10; i++) expect(g.sample(2)).toBe(false);
  });
});
