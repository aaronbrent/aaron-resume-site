import { describe, expect, it } from "vitest";
import { stepTarget } from "./keyboard-nav";

// Hero + five 800px sections, viewport 800, footer after (max scroll 4480).
const stops = [0, 800, 1600, 2400, 3200, 4000];
const vh = 800;

describe("stepTarget", () => {
  it("steps forward and back between stops", () => {
    expect(stepTarget(0, stops, "ArrowDown", vh)).toEqual({ stop: 1, top: 800 });
    expect(stepTarget(1600, stops, "ArrowUp", vh)).toEqual({ stop: 1, top: 800 });
    expect(stepTarget(0, stops, "ArrowUp", vh)).toBeNull();
  });

  it("goes to the next stop ahead when between stops", () => {
    expect(stepTarget(1000, stops, "ArrowDown", vh)).toEqual({ stop: 2, top: 1600 });
    expect(stepTarget(1000, stops, "ArrowUp", vh)).toEqual({ stop: 1, top: 800 });
  });

  it("treats sub-pixel landings as parked (no stuck steps)", () => {
    const frac = [0, 900, 1800.156, 2700.31];
    expect(stepTarget(1800, frac, "ArrowDown", 900)).toEqual({ stop: 3, top: 2700.31 });
    expect(stepTarget(2700, frac, "ArrowUp", 900)).toEqual({ stop: 2, top: 1800.156 });
  });

  it("lets the browser scroll into the footer, and back up to the last planet", () => {
    expect(stepTarget(4000, stops, "ArrowDown", vh)).toBeNull();
    expect(stepTarget(4480, stops, "ArrowDown", vh)).toBeNull();
    expect(stepTarget(4480, stops, "ArrowUp", vh)).toEqual({ stop: 5, top: 4000 });
  });

  it("never skips content in sections taller than the viewport", () => {
    // Landscape phone: 390px viewport, 650px sections.
    const tall = [0, 650, 1300, 1950];
    expect(stepTarget(650, tall, "ArrowDown", 390)).toBeNull();
    expect(stepTarget(1000, tall, "ArrowDown", 390)).toEqual({ stop: 2, top: 1300 });
    expect(stepTarget(1200, tall, "ArrowUp", 390)).toBeNull();
  });

  it("Home/End jump to the sun and the outermost planet; other keys pass", () => {
    expect(stepTarget(2400, stops, "Home", vh)).toEqual({ stop: 0, top: 0 });
    expect(stepTarget(800, stops, "End", vh)).toEqual({ stop: 5, top: 4000 });
    expect(stepTarget(800, stops, "PageDown", vh)).toBeNull();
  });
});
