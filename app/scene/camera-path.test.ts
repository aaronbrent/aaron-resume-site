import { Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { planets } from "~/content/planets";
import { dwellRange } from "~/lib/progress";
import { buildCameraPath, dwellPose, easeInOutCubic, heroPose } from "./camera-path";
import { SUN_RADIUS } from "./constants";
import { planetPosition } from "./layout";

const path = buildCameraPath(planets);
const v = (a: readonly number[]) => new Vector3(a[0], a[1], a[2]);

describe("camera path", () => {
  it("starts on the hero pose and ends parked at the outermost planet", () => {
    expect(path.stops).toBe(planets.length + 1);
    expect(v(path.poseAt(0).position).distanceTo(v(heroPose().position))).toBeLessThan(
      1e-6,
    );
    const last = dwellPose(planets[planets.length - 1]!);
    expect(v(path.poseAt(1).position).distanceTo(v(last.position))).toBeLessThan(1e-6);
  });

  it("parks exactly on each planet's dwell pose at its dwell center", () => {
    planets.forEach((p, i) => {
      const pose = path.poseAt(dwellRange(i, planets.length).center);
      expect(v(pose.position).distanceTo(v(dwellPose(p).position))).toBeLessThan(1e-6);
    });
  });

  it("frames each planet from its sun side at a size-scaled distance", () => {
    for (const p of planets) {
      const pose = dwellPose(p);
      const planet = v(planetPosition(p.visual));
      const cam = v(pose.position);
      const d = cam.distanceTo(planet);
      expect(d).toBeGreaterThan(p.visual.size * 2.5);
      expect(d).toBeLessThan(p.visual.size * 8 + 2);
      // Camera is closer to the sun than the planet is → lit face visible.
      expect(cam.length()).toBeLessThan(planet.length());
    }
  });

  it("moves only a little within a dwell window (parked)", () => {
    planets.forEach((_, i) => {
      const r = dwellRange(i, planets.length);
      const a = v(path.poseAt(r.start).position);
      const b = v(path.poseAt(r.end).position);
      expect(a.distanceTo(b)).toBeLessThan(1);
    });
  });

  it("is continuous: no jumps between consecutive samples", () => {
    let prev = v(path.poseAt(0).position);
    let maxStep = 0;
    for (let i = 1; i <= 2000; i++) {
      const next = v(path.poseAt(i / 2000).position);
      maxStep = Math.max(maxStep, next.distanceTo(prev));
      prev = next;
    }
    expect(maxStep).toBeLessThan(0.5);
  });

  it("never flies through the sun", () => {
    for (let i = 0; i <= 500; i++) {
      expect(v(path.poseAt(i / 500).position).length()).toBeGreaterThan(SUN_RADIUS * 2);
    }
  });

  it("poseInto matches poseAt without allocating new vectors", () => {
    const pos = new Vector3();
    const tgt = new Vector3();
    path.poseInto(0.37, pos, tgt);
    const pose = path.poseAt(0.37);
    expect(pos.distanceTo(v(pose.position))).toBeLessThan(1e-9);
    expect(tgt.distanceTo(v(pose.target))).toBeLessThan(1e-9);
  });

  it("portrait framing pulls back and aims lower (planet above the panel)", () => {
    for (const p of planets) {
      const planet = v(planetPosition(p.visual));
      const land = dwellPose(p);
      const port = dwellPose(p, { portrait: true });
      expect(v(port.position).distanceTo(planet)).toBeGreaterThan(
        v(land.position).distanceTo(planet),
      );
      expect(port.target[1]).toBeLessThan(land.target[1]);
    }
  });
});

describe("easeInOutCubic", () => {
  it("is 0 → 1, symmetric, flat at the ends", () => {
    expect(easeInOutCubic(0)).toBe(0);
    expect(easeInOutCubic(1)).toBe(1);
    expect(easeInOutCubic(0.5)).toBeCloseTo(0.5);
    expect(easeInOutCubic(0.01)).toBeLessThan(0.001);
  });
});
