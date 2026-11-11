import { Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { planets } from "~/content/planets";
import { dwellRange } from "~/lib/progress";
import { buildCameraPath, easeInOutCubic, heroPose, PAN_END } from "./camera-path";
import { SUN_RADIUS } from "./constants";
import { planetPosition } from "./layout";

const path = buildCameraPath(planets);
const v = (a: readonly number[]) => new Vector3(a[0], a[1], a[2]);
const n = planets.length;
const centre = (i: number) => v(planetPosition(planets[i]!.visual));
const deg = (r: number) => (r * 180) / Math.PI;

/** Progress at travel-local t on leg k (dwell k → dwell k + 1). */
function legProgress(k: number, t: number): number {
  const half = dwellRange(0, n).end - dwellRange(0, n).center; // in progress units
  const start = k / n + half;
  const end = (k + 1) / n - half;
  return start + (end - start) * t;
}

/** How the next planet appears from parked dwell k: yaw (+ left), pitch (+ up), degrees. */
function seen(k: number) {
  const d = path.dwells[k]!;
  const pos = v(d.position);
  const view = v(d.target).sub(pos).normalize();
  const next = centre(k).sub(pos).normalize();
  const vh = new Vector3(view.x, 0, view.z).normalize();
  const nh = new Vector3(next.x, 0, next.z).normalize();
  return {
    yaw: deg(Math.atan2(vh.clone().cross(nh).y, vh.dot(nh))),
    pitch: deg(Math.asin(next.y) - Math.asin(view.y)),
  };
}

function segmentDistance(a: Vector3, b: Vector3, p: Vector3): number {
  const ab = b.clone().sub(a);
  const t = Math.max(0, Math.min(1, p.clone().sub(a).dot(ab) / ab.lengthSq()));
  return a.clone().addScaledVector(ab, t).distanceTo(p);
}

describe("camera path", () => {
  it("starts on the hero pose and ends parked at the outermost planet", () => {
    expect(path.stops).toBe(n + 1);
    expect(v(path.poseAt(0).position).distanceTo(v(heroPose().position))).toBeLessThan(
      1e-6,
    );
    expect(
      v(path.poseAt(1).position).distanceTo(v(path.dwells[n]!.position)),
    ).toBeLessThan(1e-6);
  });

  it("parks exactly on each planet's dwell pose at its dwell center", () => {
    planets.forEach((_, i) => {
      const pose = path.poseAt(dwellRange(i, n).center);
      expect(v(pose.position).distanceTo(v(path.dwells[i + 1]!.position))).toBeLessThan(
        1e-6,
      );
      expect(v(pose.target).distanceTo(v(path.dwells[i + 1]!.target))).toBeLessThan(1e-6);
    });
  });

  it("frames each planet at a size-scaled distance, its sunlit face toward the camera", () => {
    planets.forEach((p, i) => {
      const cam = v(path.dwells[i + 1]!.position);
      const planet = centre(i);
      const d = cam.distanceTo(planet);
      expect(d).toBeGreaterThan(p.visual.size * 2.5);
      expect(d).toBeLessThan(p.visual.size * 8 + 2);
      // Angle between "toward the camera" and "toward the sun" at the planet.
      const lit = deg(cam.clone().sub(planet).angleTo(planet.clone().negate()));
      expect(lit, `${p.id} lit-side angle`).toBeLessThan(95);
    });
  });

  it("pans first: holds position and turns to look straight at the next planet", () => {
    for (let k = 0; k < n; k++) {
      const start = v(path.dwells[k]!.position);
      const pose = path.poseAt(legProgress(k, PAN_END));
      const pos = v(pose.position);
      const leg = start.distanceTo(v(path.dwells[k + 1]!.position));
      expect(pos.distanceTo(start)).toBeLessThan(leg * 0.1);
      const look = v(pose.target).sub(pos).normalize();
      const toNext = centre(k).sub(pos).normalize();
      expect(deg(look.angleTo(toNext)), `leg ${k} aim`).toBeLessThan(3);
    }
  });

  it("then dollies in a straight line: no swooping up or down", () => {
    for (let k = 0; k < n; k++) {
      const yA = path.dwells[k]!.position[1];
      const yB = path.dwells[k + 1]!.position[1];
      for (let t = PAN_END; t <= 1; t += 0.05) {
        const y = path.poseAt(legProgress(k, t)).position[1];
        expect(y).toBeGreaterThanOrEqual(Math.min(yA, yB) - 0.5);
        expect(y).toBeLessThanOrEqual(Math.max(yA, yB) + 0.5);
      }
    }
  });

  it("keeps every flight leg clear of the sun and the other planets", () => {
    for (let k = 0; k < n; k++) {
      const a = v(path.dwells[k]!.position);
      const b = v(path.dwells[k + 1]!.position);
      expect(segmentDistance(a, b, new Vector3())).toBeGreaterThan(SUN_RADIUS * 2);
      planets.forEach((p, i) => {
        if (i === k || i === k - 1) return; // the planets it leaves and approaches
        expect(segmentDistance(a, b, centre(i)), `leg ${k} vs ${p.id}`).toBeGreaterThan(
          p.visual.size * 2,
        );
      });
    }
  });

  it("varies direction: left and right, up and down, and one nearly straight ahead", () => {
    const legs = planets.map((_, k) => seen(k));
    let signChanges = 0;
    for (let k = 1; k < legs.length; k++) {
      if (Math.sign(legs[k]!.yaw) !== Math.sign(legs[k - 1]!.yaw)) signChanges++;
    }
    expect(signChanges).toBeGreaterThanOrEqual(2);
    expect(legs.some((l) => l.pitch > 8)).toBe(true);
    expect(legs.some((l) => l.pitch < -8)).toBe(true);
    expect(legs.some((l) => Math.abs(l.yaw) < 15)).toBe(true);
  });

  it("is continuous: no jumps between consecutive samples", () => {
    let prev = v(path.poseAt(0).position);
    let maxStep = 0;
    for (let i = 1; i <= 4000; i++) {
      const next = v(path.poseAt(i / 4000).position);
      maxStep = Math.max(maxStep, next.distanceTo(prev));
      prev = next;
    }
    expect(maxStep).toBeLessThan(0.5);
  });

  it("aim is continuous too (no snapping look direction)", () => {
    let prev = v(path.poseAt(0).target)
      .sub(v(path.poseAt(0).position))
      .normalize();
    let maxTurn = 0;
    for (let i = 1; i <= 4000; i++) {
      const pose = path.poseAt(i / 4000);
      const dir = v(pose.target).sub(v(pose.position)).normalize();
      maxTurn = Math.max(maxTurn, deg(dir.angleTo(prev)));
      prev = dir;
    }
    expect(maxTurn).toBeLessThan(2);
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
    const portrait = buildCameraPath(planets, { portrait: true });
    planets.forEach((_, i) => {
      const planet = centre(i);
      const land = path.dwells[i + 1]!;
      const port = portrait.dwells[i + 1]!;
      expect(v(port.position).distanceTo(planet)).toBeGreaterThan(
        v(land.position).distanceTo(planet),
      );
      expect(port.target[1]).toBeLessThan(planet.y);
    });
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
