import { useLayoutEffect } from "react";
import { PerspectiveCamera, Vector3 } from "three";
import { useThree } from "@react-three/fiber";
import { planets } from "~/content/planets";
import { planetPosition } from "./layout";
import { SUN_RADIUS } from "./constants";
import type { Vec3 } from "./types";

/**
 * TEMPORARY (W2a): a fixed overview pose that frames the whole system from a
 * slight elevation. W3 replaces this component with the scroll-driven rig —
 * nothing else in the scene depends on it (the camera-side fill light in
 * Lighting.tsx follows whatever the default camera does).
 */

const deg = (d: number) => (d * Math.PI) / 180;

/** Azimuth around +y, measured from +z. */
const AZIMUTH = deg(-14);
/**
 * Landscape: a low, cinematic elevation. Portrait is width-bound, so it
 * looks down more steeply (the disc fills more of the tall frame), with a
 * wider lens and less margin.
 */
const LANDSCAPE = { elevation: deg(24), fov: 38, fill: 0.82 };
const PORTRAIT = { elevation: deg(36), fov: 55, fill: 0.92 };

export interface CameraPose {
  position: Vec3;
  target: Vec3;
  fov: number;
}

/** Sun + planets as bounding spheres; this is what the overview must show. */
function bodies(): { centre: Vector3; radius: number }[] {
  return [
    { centre: new Vector3(0, 0, 0), radius: SUN_RADIUS * 1.6 },
    ...planets.map((p) => ({
      centre: new Vector3(...planetPosition(p.visual)),
      radius: p.visual.size * 1.4,
    })),
  ];
}

/**
 * Deterministic overview pose for an aspect ratio: aim at the bodies' centre
 * and pull back (binary search) until every body fits inside `fill` of the
 * frame. Pure apart from scratch objects; safe to call every resize.
 */
export function overviewPose(aspect: number): CameraPose {
  const { elevation, fov, fill } = aspect < 1 ? PORTRAIT : LANDSCAPE;
  const all = bodies();
  const target = new Vector3();
  for (const b of all) target.add(b.centre);
  target.divideScalar(all.length);
  const dir = new Vector3(
    Math.sin(AZIMUTH) * Math.cos(elevation),
    Math.sin(elevation),
    Math.cos(AZIMUTH) * Math.cos(elevation),
  );
  const cam = new PerspectiveCamera(fov, aspect, 0.1, 2000);
  const probe = new Vector3();
  const offsets = [
    [1, 0, 0],
    [-1, 0, 0],
    [0, 1, 0],
    [0, -1, 0],
    [0, 0, 1],
    [0, 0, -1],
  ] as const;
  const fits = (distance: number): boolean => {
    cam.position.copy(target).addScaledVector(dir, distance);
    cam.lookAt(target);
    cam.updateMatrixWorld();
    cam.updateProjectionMatrix();
    for (const b of all) {
      for (const [x, y, z] of offsets) {
        probe.set(x, y, z).multiplyScalar(b.radius).add(b.centre).project(cam);
        if (Math.abs(probe.x) > fill || Math.abs(probe.y) > fill || probe.z > 1)
          return false;
      }
    }
    return true;
  };
  let lo = 40; // outside every orbit, so all bodies are in front of the lens
  let hi = 1000;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (fits(mid)) hi = mid;
    else lo = mid;
  }
  const position = target.clone().addScaledVector(dir, hi);
  return {
    position: [position.x, position.y, position.z],
    target: [target.x, target.y, target.z],
    fov,
  };
}

export function OverviewCamera() {
  const camera = useThree((s) => s.camera);
  const aspect = useThree((s) => s.size.width / Math.max(1, s.size.height));
  const invalidate = useThree((s) => s.invalidate);

  useLayoutEffect(() => {
    if (!(camera instanceof PerspectiveCamera)) return;
    const pose = overviewPose(aspect);
    camera.fov = pose.fov;
    camera.position.set(...pose.position);
    camera.lookAt(...pose.target);
    camera.updateProjectionMatrix();
    invalidate();
  }, [camera, aspect, invalidate]);

  return null;
}
