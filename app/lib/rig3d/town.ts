import {
  AdditiveBlending,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  CylinderGeometry,
  DoubleSide,
  Group,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  PlaneGeometry,
  Quaternion,
  SRGBColorSpace,
  Vector3,
} from "three";
import type { TownPlan } from "~/lib/world/town";
import { mergeColoredParts } from "./merge";
import { ANIME } from "./palette";

/**
 * The village, rendered (PLAN-3D ADR-9, amended; dressed in Phase G5):
 * timber and plaster bodies, snow-capped gable roofs, masonry chimneys with
 * smoke standing in the still evening air, streetlamps ringing the plaza,
 * and warm halos blooming from every lit window — the dusk payoff the whole
 * golden-hour palette has been pointing at. Seven draws for the whole town.
 * Buildings stand on real basin ground via heightAt, and their materials
 * keep fog on, so the town emerges from the haze as the run descends.
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

/** Soft radial bloom for windows and lamps — one shared additive texture. */
function glowTexture(): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 32);
  g.addColorStop(0, "rgba(255,214,138,0.55)");
  g.addColorStop(0.4, "rgba(255,194,116,0.22)");
  g.addColorStop(1, "rgba(255,194,116,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

/** A faint standing smoke column: stacked translucent puffs. */
function smokeTexture(): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 32;
  canvas.height = 64;
  const ctx = canvas.getContext("2d")!;
  const c = `#${ANIME.smoke.getHexString()}`;
  for (let i = 0; i < 5; i++) {
    const f = i / 4;
    const r = 4 + f * 8;
    const x = 16 + Math.sin(f * 5.2) * 4 * f;
    const y = 58 - f * 48;
    const g = ctx.createRadialGradient(x, y, r * 0.2, x, y, r);
    const alpha = Math.round((0.34 - f * 0.22) * 255)
      .toString(16)
      .padStart(2, "0");
    g.addColorStop(0, `${c}${alpha}`);
    g.addColorStop(1, `${c}00`);
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
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
  // Chimney and snow cap baked into one vertex-colored stack: one draw.
  const chimneyBody = new BoxGeometry(0.55, 1.3, 0.55);
  chimneyBody.translate(0, 0.65, 0);
  const chimneyCap = new BoxGeometry(0.75, 0.16, 0.75);
  chimneyCap.translate(0, 1.33, 0);
  const chimneyGeometry = mergeColoredParts([
    { geometry: chimneyBody, color: ANIME.masonry },
    { geometry: chimneyCap, color: ANIME.snowDust },
  ]);
  const chimneyMaterial = new MeshBasicMaterial({ vertexColors: true });
  const lampGeometry = new CylinderGeometry(0.045, 0.065, 3.2, 5);
  lampGeometry.translate(0, 1.6, 0);
  const bodyMaterial = new MeshBasicMaterial({ color: 0xffffff });
  const roofMaterial = new MeshBasicMaterial({ color: 0xffffff });
  const windowMaterial = new MeshBasicMaterial({ color: new Color("#ffd08a") });
  const lampMaterial = new MeshBasicMaterial({ color: ANIME.steel });
  const glowMap = glowTexture();
  const glowMaterial = new MeshBasicMaterial({
    map: glowMap,
    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
    side: DoubleSide,
  });
  const smokeMap = smokeTexture();
  const smokeMaterial = new MeshBasicMaterial({
    map: smokeMap,
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
  });
  resources.push(bodyGeometry, roofGeo, windowGeometry, chimneyGeometry);
  resources.push(lampGeometry, glowMap, smokeMap);
  resources.push(bodyMaterial, roofMaterial, windowMaterial, chimneyMaterial);
  resources.push(lampMaterial, glowMaterial, smokeMaterial);

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
  // Chimneys on most chalets; some of them smoke in the evening air.
  const chimneySlots: Array<{ b: (typeof buildings)[number]; oz: number }> = [];
  for (const b of buildings) {
    if (b.kind === "tower" || rand() < 0.2) continue;
    chimneySlots.push({ b, oz: (rand() < 0.5 ? -1 : 1) * b.d * (0.14 + rand() * 0.16) });
  }
  const smokeSlots = chimneySlots.filter(() => rand() < 0.45);
  // Streetlamps ring the plaza.
  const lampSlots: Array<{ x: number; z: number }> = [];
  const lampCount = 9;
  for (let i = 0; i < lampCount; i++) {
    const a = (i / lampCount) * Math.PI * 2 + 0.3;
    lampSlots.push({
      x: plan.center.x + Math.cos(a) * (16 + rand() * 5),
      z: plan.center.z + Math.sin(a) * (19 + rand() * 6),
    });
  }

  const bodies = new InstancedMesh(bodyGeometry, bodyMaterial, buildings.length);
  const roofs = new InstancedMesh(roofGeo, roofMaterial, buildings.length);
  const windows = new InstancedMesh(windowGeometry, windowMaterial, windowSlots.length);
  const chimneys = new InstancedMesh(chimneyGeometry, chimneyMaterial, chimneySlots.length);
  const lamps = new InstancedMesh(lampGeometry, lampMaterial, lampSlots.length);
  const glows = new InstancedMesh(
    windowGeometry,
    glowMaterial,
    windowSlots.length + lampSlots.length,
  );
  const smoke = new InstancedMesh(windowGeometry, smokeMaterial, smokeSlots.length);

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
    // A village of materials: warm timber mostly, plaster among it, the
    // church tower always masonry-pale.
    if (b.kind === "tower" || rand() < 0.34) {
      tint.copy(ANIME.plaster).offsetHSL(0, 0, (rand() - 0.5) * 0.06);
    } else {
      tint.copy(ANIME.wood).offsetHSL(0, 0, (rand() - 0.5) * 0.1);
    }
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
  const placeOnWall = (
    slot: (typeof windowSlots)[number],
    grow: number,
    out: { mesh: InstancedMesh; index: number },
  ) => {
    const ground = heightAt(slot.bx, slot.bz) - 0.25;
    yRot.setFromAxisAngle(up, slot.yaw);
    // The plane faces +z; turn it to face out of the wall (local ±x).
    windowQuat
      .setFromAxisAngle(up, slot.ox > 0 ? Math.PI / 2 : -Math.PI / 2)
      .premultiply(yRot);
    const c = Math.cos(slot.yaw);
    const s = Math.sin(slot.yaw);
    pos.set(
      slot.bx + (slot.ox * (1 + grow * 0.02)) * c + slot.oz * s,
      ground + slot.oy,
      slot.bz - (slot.ox * (1 + grow * 0.02)) * s + slot.oz * c,
    );
    scale.set(slot.w * (1 + grow), slot.h * (1 + grow), 1);
    m.compose(pos, windowQuat, scale);
    out.mesh.setMatrixAt(out.index, m);
  };
  windowSlots.forEach((slot, i) => {
    placeOnWall(slot, 0, { mesh: windows, index: i });
    // The bloom: a larger soft quad just off the same wall.
    placeOnWall(slot, 2.6, { mesh: glows, index: i });
  });

  chimneySlots.forEach((slot, i) => {
    const { b, oz } = slot;
    const ground = heightAt(b.x, b.z) - 0.25;
    q.setFromAxisAngle(up, b.yaw);
    const c = Math.cos(b.yaw);
    const s = Math.sin(b.yaw);
    // On the ridge line (local x=0), part-way along the roof's run.
    const cx = b.x + oz * s;
    const cz = b.z + oz * c;
    const roofRise = b.h * 0.75;
    pos.set(cx, ground + b.h + roofRise - 0.55, cz);
    m.compose(pos, q, scale.set(1, 1, 1));
    chimneys.setMatrixAt(i, m);
  });

  smokeSlots.forEach((slot, i) => {
    const { b, oz } = slot;
    const ground = heightAt(b.x, b.z) - 0.25;
    const c = Math.cos(b.yaw);
    const s = Math.sin(b.yaw);
    const cx = b.x + oz * s;
    const cz = b.z + oz * c;
    // Face up-valley toward the arriving rider; a still, standing column.
    q.setFromAxisAngle(up, Math.PI + (rand() - 0.5) * 0.6);
    pos.set(cx, ground + b.h * 1.75 + 2.6, cz);
    scale.set(2.0 + rand() * 0.8, 4.4 + rand() * 1.6, 1);
    m.compose(pos, q, scale);
    smoke.setMatrixAt(i, m);
  });

  lampSlots.forEach((slot, i) => {
    const ground = heightAt(slot.x, slot.z) - 0.15;
    q.identity();
    pos.set(slot.x, ground, slot.z);
    m.compose(pos, q, scale.set(1, 1, 1));
    lamps.setMatrixAt(i, m);
    // The lamp's bloom, facing up-valley like the smoke.
    q.setFromAxisAngle(up, Math.PI);
    pos.set(slot.x, ground + 3.35, slot.z);
    scale.set(2.6, 2.6, 1);
    m.compose(pos, q, scale);
    glows.setMatrixAt(windowSlots.length + i, m);
  });

  bodies.instanceMatrix.needsUpdate = true;
  roofs.instanceMatrix.needsUpdate = true;
  windows.instanceMatrix.needsUpdate = true;
  chimneys.instanceMatrix.needsUpdate = true;
  lamps.instanceMatrix.needsUpdate = true;
  glows.instanceMatrix.needsUpdate = true;
  smoke.instanceMatrix.needsUpdate = true;
  if (bodies.instanceColor) bodies.instanceColor.needsUpdate = true;
  if (roofs.instanceColor) roofs.instanceColor.needsUpdate = true;

  group.add(bodies, roofs, windows, chimneys, lamps, glows, smoke);
  return { group, resources };
}
