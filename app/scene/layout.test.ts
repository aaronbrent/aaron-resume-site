import { describe, expect, it } from "vitest";
import { planets } from "~/content/planets";
import { planetPosition } from "./layout";

describe("planetPosition", () => {
  it("places each planet on its orbit in the y = 0 plane", () => {
    for (const p of planets) {
      const [x, y, z] = planetPosition(p.visual);
      expect(y).toBe(0);
      expect(Math.hypot(x, z)).toBeCloseTo(p.visual.orbitRadius);
    }
  });

  it("maps angle 0 to +x and 90° to −z", () => {
    const [x0, , z0] = planetPosition({ orbitRadius: 2, orbitAngle: 0 });
    expect(x0).toBeCloseTo(2);
    expect(z0).toBeCloseTo(0);
    const [x1, , z1] = planetPosition({ orbitRadius: 2, orbitAngle: Math.PI / 2 });
    expect(x1).toBeCloseTo(0);
    expect(z1).toBeCloseTo(-2);
  });

  it("keeps neighbouring planets well separated", () => {
    for (let i = 1; i < planets.length; i++) {
      const a = planetPosition(planets[i - 1]!.visual);
      const b = planetPosition(planets[i]!.visual);
      expect(Math.hypot(a[0] - b[0], a[2] - b[2])).toBeGreaterThan(5);
    }
  });
});
