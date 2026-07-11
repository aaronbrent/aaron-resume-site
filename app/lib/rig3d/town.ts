import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  Group,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  PlaneGeometry,
  Quaternion,
  Vector3,
} from "three";
import type { TownPlan } from "~/lib/world/town";
import { ANIME } from "./palette";

/**
 * The village, rendered (PLAN-3D ADR-9, amended): timber bodies, snow-capped
 * gable roofs, and warm window lights — three instanced draws for the whole
 * town. Buildings stand on real basin ground via heightAt, and their
 * materials keep fog on, so the town emerges from the haze as the run
 * descends toward it.
 */

export interface Town {
  group: Group;
  resources: Array<{ dispose(): void }>;
}

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Unit gable-roof prism: ridge along z, eaves at y=0, apex at y=1. */
function roofGeometry(): BufferGeometry {
  // prettier-ignore
  const tris = [
    // End caps (gables).
    -0.5, 0, -0.5,  0.5, 0, -0.5,  0, 1, -0.5,
    0.5, 0, 0.5,  -0.5, 0, 0.5,  0, 1, 0.5,
    // Roof slopes.
    -0.5, 0, -0.5,  0, 1, -0.5,  0, 1, 0.5,
    -0.5, 0, -0.5,  0, 1, 0.5,  -0.5, 0, 0.5,
    0.5, 0, -0.5,  0.5, 0, 0.5,  0, 1, 0.5,
    0.5, 0, -0.5,  0, 1, 0.5,  0, 1, -0.5,
  ];
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(new Float32Array(tris), 3));
  return geometry;
}

export function createTown(
  plan: TownPlan,
  heightAt: (x: number, z: number) => number,
  seed: number,
): Town {
  const rand = mulberry32(seed ^ 0x9b3d1);
  const group = new Group();
  const resources: Array<{ dispose(): void }> = [];

  const bodyGeometry = new BoxGeometry(1, 1, 1);
  bodyGeometry.translate(0, 0.5, 0);
  const roofGeo = roofGeometry();
  const windowGeometry = new PlaneGeometry(1, 1);
  const bodyMaterial = new MeshBasicMaterial({ color: 0xffffff });
  const roofMaterial = new MeshBasicMaterial({ color: 0xffffff });
  const windowMaterial = new MeshBasicMaterial({ color: new Color("#ffd08a") });
  resources.push(bodyGeometry, roofGeo, windowGeometry);
  resources.push(bodyMaterial, roofMaterial, windowMaterial);

  const buildings = plan.buildings;
  // Windows first: count them so the instance pool is exact.
  const windowSlots: Array<{
    bx: number;
    bz: number;
    yaw: number;
    ox: number;
    oy: number;
    oz: number;
    w: number;
    h: number;
  }> = [];
  for (const b of buildings) {
    const per = b.kind === "tower" ? 2 : 2 + Math.floor(b.glow * 4);
    for (let i = 0; i < per; i++) {
      if (rand() > 0.4 + b.glow * 0.6) continue;
      // Alternate the two long walls; spread along the depth.
      const side = i % 2 === 0 ? 1 : -1;
      windowSlots.push({
        bx: b.x,
        bz: b.z,
        yaw: b.yaw,
        ox: side * (b.w / 2 + 0.03),
        oy: b.kind === "tower" ? 2 + rand() * (b.h - 3) : 0.9 + rand() * (b.h - 1.6),
        oz: (rand() - 0.5) * b.d * 0.7,
        w: 0.7 + rand() * 0.5,
        h: 0.9 + rand() * 0.5,
      });
    }
  }

  const bodies = new InstancedMesh(bodyGeometry, bodyMaterial, buildings.length);
  const roofs = new InstancedMesh(roofGeo, roofMaterial, buildings.length);
  const windows = new InstancedMesh(windowGeometry, windowMaterial, windowSlots.length);

  const m = new Matrix4();
  const q = new Quaternion();
  const pos = new Vector3();
  const scale = new Vector3();
  const up = new Vector3(0, 1, 0);
  const tint = new Color();
  buildings.forEach((b, i) => {
    const ground = heightAt(b.x, b.z) - 0.25;
    q.setFromAxisAngle(up, b.yaw);
    pos.set(b.x, ground, b.z);
    scale.set(b.w, b.h, b.d);
    m.compose(pos, q, scale);
    bodies.setMatrixAt(i, m);
    // Warm timber, a little varied so the village reads lived-in.
    tint.copy(ANIME.wood).offsetHSL(0, 0, (rand() - 0.5) * 0.08);
    bodies.setColorAt(i, tint);

    const steep = b.kind === "tower";
    pos.set(b.x, ground + b.h - 0.05, b.z);
    scale.set(b.w * 1.24, steep ? b.h * 0.9 : b.h * 0.75, b.d * (steep ? 1.24 : 1.14));
    m.compose(pos, q, scale);
    roofs.setMatrixAt(i, m);
    tint.copy(ANIME.snowDust).offsetHSL(0, 0, (rand() - 0.5) * 0.03);
    roofs.setColorAt(i, tint);
  });

  const windowQuat = new Quaternion();
  const yRot = new Quaternion();
  windowSlots.forEach((slot, i) => {
    const ground = heightAt(slot.bx, slot.bz) - 0.25;
    yRot.setFromAxisAngle(up, slot.yaw);
    // The plane faces +z; turn it to face out of the wall (local ±x).
    windowQuat
      .setFromAxisAngle(up, slot.ox > 0 ? Math.PI / 2 : -Math.PI / 2)
      .premultiply(yRot);
    const c = Math.cos(slot.yaw);
    const s = Math.sin(slot.yaw);
    pos.set(
      slot.bx + slot.ox * c + slot.oz * s,
      ground + slot.oy,
      slot.bz - slot.ox * s + slot.oz * c,
    );
    scale.set(slot.w, slot.h, 1);
    m.compose(pos, windowQuat, scale);
    windows.setMatrixAt(i, m);
  });

  bodies.instanceMatrix.needsUpdate = true;
  roofs.instanceMatrix.needsUpdate = true;
  windows.instanceMatrix.needsUpdate = true;
  if (bodies.instanceColor) bodies.instanceColor.needsUpdate = true;
  if (roofs.instanceColor) roofs.instanceColor.needsUpdate = true;

  group.add(bodies, roofs, windows);
  return { group, resources };
}
