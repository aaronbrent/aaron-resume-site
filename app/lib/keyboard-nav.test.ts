import { describe, expect, it } from "vitest";
import { nextStop } from "./keyboard-nav";

describe("nextStop", () => {
  it("steps forward and back between stops, clamped", () => {
    expect(nextStop(0, "ArrowDown", 5)).toBe(1);
    expect(nextStop(2, "ArrowUp", 5)).toBe(1);
    expect(nextStop(5, "ArrowDown", 5)).toBe(5);
    expect(nextStop(0, "ArrowUp", 5)).toBe(0);
  });

  it("goes to the next stop ahead when between stops", () => {
    expect(nextStop(1.2, "ArrowDown", 5)).toBe(2);
    expect(nextStop(1.8, "ArrowDown", 5)).toBe(2);
    expect(nextStop(1.8, "ArrowUp", 5)).toBe(1);
    expect(nextStop(1.2, "ArrowUp", 5)).toBe(1);
  });

  it("Home/End jump to the sun and the outermost planet", () => {
    expect(nextStop(3, "Home", 5)).toBe(0);
    expect(nextStop(1, "End", 5)).toBe(5);
  });

  it("ignores other keys", () => {
    expect(nextStop(1, "PageDown", 5)).toBeNull();
    expect(nextStop(1, "a", 5)).toBeNull();
  });
});
