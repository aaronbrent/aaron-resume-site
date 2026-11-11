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
  it("steps down on very slow devices (sub-2 fps frames count)", () => {
    const g = new FpsGovernor(1.5, 2);
    let tripped = false;
    for (let i = 0; i < 10; i++) tripped = g.sample(1.1) || tripped;
    expect(tripped).toBe(true);
  });

  it("keeps the tier on a display capped at 30 Hz", () => {
    expect(run(new FpsGovernor(), 30, 10)).toBe(false);
  });

  it("doesn't drop a tier on the first frame back from a hidden tab", () => {
    const g = new FpsGovernor(1.5, 2);
    expect(run(g, 60, 6)).toBe(false); // healthy, warmed up
    g.reset(); // visibilitychange
    expect(g.sample(30)).toBe(false); // the resumed frame spans the pause
    expect(run(g, 60, 6)).toBe(false);
  });

  it("reset() discards a window spoiled by a hidden tab", () => {
    const g = new FpsGovernor(0, 2);
    g.sample(1.9); // the tab was hidden mid-window
    g.reset();
    expect(run(g, 60, 3)).toBe(false);
  });
});
