import { Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { dwellRange } from "~/lib/progress";
import {
  buildCameraPath,
  easeInOutCubic,
  heroPose,
  MIN_SWEEP,
  SETTLE_START,
  SLING_TIME,
  SUN_KEEP_OUT,
} from "./camera-path";
import { SUN_RADIUS } from "./constants";
import { generateLayout, LAYOUT_RULES } from "./system-layout";

const layout = generateLayout();
const planets = layout.planets;
const path = buildCameraPath(planets);
const v = (a: readonly number[]) => new Vector3(a[0], a[1], a[2]);
const n = planets.length;
const centre = (i: number) => v(planets[i]!.position);
const deg = (r: number) => (r * 180) / Math.PI;

/** Progress at travel-local t on leg k (dwell k → dwell k + 1). */
function legProgress(k: number, t: number): number {
  const half = dwellRange(0, n).end - dwellRange(0, n).center; // in progress units
  const start = k / n + half;
  const end = (k + 1) / n - half;
  return start + (end - start) * t;
}

/** Body slung around on leg k: the sun, then each planet in turn. */
const body = (k: number) => (k === 0 ? new Vector3() : centre(k - 1));

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

  it("leaves and arrives exactly: legs join the dwell poses with no jump", () => {
    for (let k = 0; k < n; k++) {
      const start = path.poseAt(legProgress(k, 0));
      const end = path.poseAt(legProgress(k, 1));
      expect(v(start.target).distanceTo(v(path.dwells[k]!.target))).toBeLessThan(1e-6);
      expect(v(end.target).distanceTo(v(path.dwells[k + 1]!.target))).toBeLessThan(1e-6);
    }
  });

  it("frames each planet at a size-scaled distance, its sunlit face toward the camera", () => {
    planets.forEach((p, i) => {
      const cam = v(path.dwells[i + 1]!.position);
      const planet = centre(i);
      const d = cam.distanceTo(planet);
      expect(d).toBeGreaterThan(p.size * 2.5);
      expect(d).toBeLessThan(p.size * 8 + 2);
      expect(d).toBeGreaterThan(p.keepOut);
      // Angle between "toward the camera" and "toward the sun" at the planet.
      const lit = deg(cam.clone().sub(planet).angleTo(planet.clone().negate()));
      expect(lit, `${p.id} lit-side angle`).toBeLessThan(80);
    });
  });

  it("slingshots: each leg swings round the body it leaves, close but clear", () => {
    path.legs.forEach((leg, k) => {
      expect(leg.sweep, `leg ${k} sweep`).toBeGreaterThanOrEqual(MIN_SWEEP - 1e-6);
      expect(leg.sweep, `leg ${k} sweep`).toBeLessThanOrEqual(LAYOUT_RULES.maxSweep);
      const c = body(k);
      expect(v(leg.body).distanceTo(c)).toBeLessThan(1e-9);
      let closest = Infinity;
      for (let t = 0; t <= SLING_TIME + 0.05; t += 0.005) {
        closest = Math.min(
          closest,
          v(path.poseAt(legProgress(k, t)).position).distanceTo(c),
        );
      }
      const keepOut = k === 0 ? SUN_KEEP_OUT : planets[k - 1]!.keepOut;
      expect(closest, `leg ${k} periapsis`).toBeGreaterThan(keepOut);
      expect(closest, `leg ${k} periapsis`).toBeLessThan(leg.periapsis * 1.3);
      // It really goes round: the bearing of the camera about the body
      // changes by about the sweep during the sling.
      const a = v(path.poseAt(legProgress(k, 0)).position)
        .sub(c)
        .normalize();
      const b = v(path.poseAt(legProgress(k, SLING_TIME)).position)
        .sub(c)
        .normalize();
      if (leg.sweep < Math.PI * 0.9) {
        expect(deg(a.angleTo(b)), `leg ${k} swing`).toBeGreaterThan(deg(leg.sweep) * 0.8);
      }
    });
  });

  it("flies the final approach straight along the parked view direction", () => {
    path.legs.forEach((leg, k) => {
      const end = v(path.dwells[k + 1]!.position);
      const into = centre(k).sub(end).normalize();
      // The approach starts on the line through the dwell and the planet,
      // behind the camera.
      const back = end.clone().sub(v(leg.approachStart));
      expect(deg(back.clone().normalize().angleTo(into)), `leg ${k}`).toBeLessThan(0.01);
      // Late in the leg the camera is on that line (give or take the dwell
      // drift, which is already ramping in).
      const pos = v(path.poseAt(legProgress(k, 0.98)).position);
      const off = pos.clone().sub(end);
      const lateral = off.clone().addScaledVector(into, -off.dot(into)).length();
      expect(lateral, `leg ${k} lateral`).toBeLessThan(0.36);
    });
  });

  it("keeps every flight leg clear of the sun and every planet's keep-out", () => {
    const samples = 3000;
    for (let i = 0; i <= samples; i++) {
      const pos = v(path.poseAt(i / samples).position);
      expect(pos.length()).toBeGreaterThan(SUN_KEEP_OUT);
      planets.forEach((p, j) => {
        expect(pos.distanceTo(centre(j)), `${p.id} at ${i / samples}`).toBeGreaterThan(
          Math.max(p.keepOut, p.size * 2),
        );
      });
    }
  });

  it("is continuous: no jumps between consecutive samples", () => {
    // Legs vary a lot in length, so bound each step against its leg's
    // average step: easing peaks at ~1.5–2× the mean speed.
    const samples = 4000;
    let prev = v(path.poseAt(0).position);
    for (let i = 1; i <= samples; i++) {
      const p = i / samples;
      const next = v(path.poseAt(p).position);
      const leg = Math.min(n - 1, Math.floor(p * n - 0.25));
      const mean = path.legs[Math.max(0, leg)]!.length / (samples / n / 2);
      expect(next.distanceTo(prev)).toBeLessThan(Math.max(0.05, mean * 2.5));
      prev = next;
    }
  });

  it("aim is continuous too (no snapping look direction)", () => {
    // The sling whips the view round by design; 2.5° per 1/4000 of the
    // flight (≈ 1 px of scroll per sample) is the measured peak plus margin.
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
    expect(maxTurn).toBeLessThan(2.5);
  });

  it("is looking at the next planet when the role card starts to fade in", () => {
    for (let k = 0; k < n; k++) {
      const pose = path.poseAt(legProgress(k, SETTLE_START));
      const look = v(pose.target).sub(v(pose.position)).normalize();
      const toPlanet = centre(k).sub(v(pose.position)).normalize();
      expect(deg(look.angleTo(toPlanet)), `leg ${k}`).toBeLessThan(3);
    }
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
