import {
  AdditiveBlending,
  BackSide,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  ShaderMaterial,
  SphereGeometry,
  SRGBColorSpace,
  Vector3,
} from "three";
import { ANIME, SUN_DIR } from "./palette";

/**
 * The sky (PLAN-3D ADR-9, amended; clouds upgraded in Phase G4): a gradient
 * dome, a low sun, four unique painted cumulus, and a cirrus veil — the
 * anime-key vault the whole run rides under. The group follows the camera's
 * position (never rotation) like the far ridges, so it is infinitely-far
 * scenery, and the cloud shells **drift with scroll**: a few degrees of slow
 * azimuthal slide across the descent, so the sky is alive while the ride
 * moves and perfectly still — costing zero frames — while the page parks.
 *
 * Every cloud is painted at init onto its own small canvas (lobed
 * cauliflower silhouettes over a flat base, salmon underlight, a bright top
 * rim) — authored code, not fetched art, deterministic from the content seed.
 */

const DOME_RADIUS_M = 3600;
const CLOUD_SHELL_M = 3250;
const SUN_DISTANCE_M = 3400;

export interface Sky {
  group: Group;
  /** Everything with a dispose(): geometries, materials, textures. */
  resources: Array<{ dispose(): void }>;
  /** Scroll-linked drift: call with ride time t each frame. */
  drift(t: number): void;
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

const domeVertex = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const domeFragment = /* glsl */ `
  uniform vec3 uZenith;
  uniform vec3 uMid;
  uniform vec3 uHorizon;
  uniform vec3 uGlow;
  uniform vec3 uHaze;
  uniform vec3 uSunDir;
  varying vec3 vDir;
  void main() {
    vec3 dir = normalize(vDir);
    float h = dir.y;
    vec3 col = mix(uHorizon, uMid, smoothstep(0.03, 0.30, h));
    col = mix(col, uZenith, smoothstep(0.30, 0.72, h));
    // Warm halo around the low sun, strongest near the horizon band.
    float sun = pow(max(dot(dir, uSunDir), 0.0), 5.0);
    col = mix(col, uGlow, sun * 0.62 * (1.0 - smoothstep(0.0, 0.5, h)));
    // Below the horizon line the vault meets the airborne haze.
    col = mix(uHaze, col, smoothstep(-0.12, 0.05, h));
    gl_FragColor = vec4(col, 1.0);
  }
`;

interface CloudProfile {
  w: number;
  h: number;
  /** Major lobes across the crown. */
  lobes: number;
  /** Crown height as a fraction of the canvas. */
  arch: number;
}

/** Four silhouettes: towering, classic, long deck, small puff. */
const CLOUD_PROFILES: CloudProfile[] = [
  { w: 256, h: 190, lobes: 5, arch: 0.52 },
  { w: 256, h: 150, lobes: 6, arch: 0.38 },
  { w: 256, h: 110, lobes: 8, arch: 0.22 },
  { w: 192, h: 120, lobes: 4, arch: 0.3 },
];

/** Paint one cumulus: lobed silhouette, flat base, underlight, top rim. */
function paintCloud(rand: () => number, profile: CloudProfile): HTMLCanvasElement {
  const { w, h, lobes, arch } = profile;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  const lit = `#${ANIME.cloudLit.getHexString()}`;
  const baseY = h * 0.8;

  // The crown: a few major lobes, each a cluster of crisp puffs; taller in
  // the middle, tapered at the ends — cauliflower, not blur. Generous body
  // fill below the crown keeps the mass reading as one cloud, never beads.
  const puffs: Array<{ x: number; y: number; r: number }> = [];
  for (let i = 0; i < lobes; i++) {
    const f = lobes === 1 ? 0.5 : i / (lobes - 1);
    const archF = Math.sin(f * Math.PI) ** 0.75;
    const cx = w * (0.12 + 0.76 * f + (rand() - 0.5) * 0.05);
    const top = baseY - h * arch * archF * (0.7 + rand() * 0.3);
    const lobeR = w * (0.07 + rand() * 0.04) * (0.72 + archF * 0.45);
    // Each lobe: a main puff, tucked shoulders, and a broad body below.
    puffs.push({ x: cx, y: top + lobeR * 0.4, r: lobeR });
    puffs.push({
      x: cx - lobeR * (0.5 + rand() * 0.2),
      y: top + lobeR * (0.75 + rand() * 0.25),
      r: lobeR * (0.68 + rand() * 0.22),
    });
    puffs.push({
      x: cx + lobeR * (0.5 + rand() * 0.2),
      y: top + lobeR * (0.75 + rand() * 0.25),
      r: lobeR * (0.68 + rand() * 0.22),
    });
    puffs.push({
      x: cx + (rand() - 0.5) * lobeR * 0.8,
      y: (top + baseY) / 2 + rand() * lobeR * 0.3,
      r: lobeR * (1.15 + rand() * 0.35),
    });
    // Bridge to the neighboring lobe so crowns never separate into beads.
    if (i > 0) {
      const pf = (i - 0.5) / (lobes - 1);
      puffs.push({
        x: w * (0.12 + 0.76 * pf),
        y: baseY - h * arch * Math.sin(pf * Math.PI) ** 0.75 * 0.45 - lobeR * 0.2,
        r: lobeR * (0.95 + rand() * 0.3),
      });
    }
  }
  for (const p of puffs) {
    const g = ctx.createRadialGradient(p.x, p.y, p.r * 0.6, p.x, p.y, p.r);
    g.addColorStop(0, lit);
    g.addColorStop(0.9, lit);
    g.addColorStop(1, `${lit}00`);
    ctx.fillStyle = g;
    ctx.fillRect(p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
  }
  // A flat base bar keeps the underside level like real cumulus.
  ctx.fillStyle = lit;
  ctx.fillRect(w * 0.14, baseY - h * 0.05, w * 0.72, h * 0.05);
  // Sunset underlight: salmon pooled along the flat base.
  ctx.globalCompositeOperation = "source-atop";
  const s = `#${ANIME.cloudShade.getHexString()}`;
  const under = ctx.createLinearGradient(0, baseY - h * 0.42, 0, baseY);
  under.addColorStop(0, `${s}00`);
  under.addColorStop(0.72, `${s}5e`);
  under.addColorStop(1, `${s}c8`);
  ctx.fillStyle = under;
  ctx.fillRect(0, 0, w, h);
  // Rim light from above.
  const rim = ctx.createLinearGradient(0, 0, 0, h);
  rim.addColorStop(0, "rgba(255,255,255,0.5)");
  rim.addColorStop(0.35, "rgba(255,255,255,0)");
  ctx.fillStyle = rim;
  ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = "source-over";
  return canvas;
}

/** The cirrus veil: long combed streaks, painted once, stretched huge. */
function paintCirrus(rand: () => number): HTMLCanvasElement {
  const w = 256;
  const h = 64;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  for (let i = 0; i < 9; i++) {
    const y = h * (0.15 + rand() * 0.7);
    const len = w * (0.3 + rand() * 0.6);
    const x0 = rand() * (w - len);
    const streak = ctx.createLinearGradient(x0, 0, x0 + len, 0);
    const alpha = 0.1 + rand() * 0.16;
    streak.addColorStop(0, "rgba(253,239,225,0)");
    streak.addColorStop(0.5, `rgba(253,239,225,${alpha.toFixed(3)})`);
    streak.addColorStop(1, "rgba(253,239,225,0)");
    ctx.fillStyle = streak;
    ctx.fillRect(x0, y, len, 1.2 + rand() * 2.2);
  }
  return canvas;
}

/**
 * Merge billboard quads (already oriented toward the dome center) into one
 * geometry so each cloud texture costs a single draw call.
 */
function cloudBatch(
  placements: Array<{ az: number; el: number; w: number; hazeMix: number }>,
  texture: CanvasTexture,
  aspect: number,
): { mesh: Mesh; geometry: BufferGeometry; material: MeshBasicMaterial } {
  const positions = new Float32Array(placements.length * 4 * 3);
  const colors = new Float32Array(placements.length * 4 * 3);
  const uvs = new Float32Array(placements.length * 4 * 2);
  const indices = new Uint16Array(placements.length * 6);
  const center = new Vector3();
  const right = new Vector3();
  const up = new Vector3();
  const tint = ANIME.cloudLit.clone();
  placements.forEach((c, i) => {
    center.set(
      Math.sin(c.az) * Math.cos(c.el),
      Math.sin(c.el),
      Math.cos(c.az) * Math.cos(c.el),
    );
    // Tangent basis on the shell: quads face the camera at the dome center.
    right.set(Math.cos(c.az), 0, -Math.sin(c.az)).multiplyScalar(c.w / 2);
    up.crossVectors(center, right)
      .normalize()
      .multiplyScalar(-c.w / (2 * aspect));
    center.multiplyScalar(CLOUD_SHELL_M);
    tint.copy(ANIME.cloudLit).lerp(ANIME.haze, c.hazeMix);
    for (let v = 0; v < 4; v++) {
      const sx = v % 2 === 0 ? -1 : 1;
      const sy = v < 2 ? -1 : 1;
      const o = (i * 4 + v) * 3;
      positions[o] = center.x + right.x * sx + up.x * sy;
      positions[o + 1] = center.y + right.y * sx + up.y * sy;
      positions[o + 2] = center.z + right.z * sx + up.z * sy;
      colors[o] = tint.r;
      colors[o + 1] = tint.g;
      colors[o + 2] = tint.b;
      uvs[(i * 4 + v) * 2] = sx === -1 ? 0 : 1;
      uvs[(i * 4 + v) * 2 + 1] = sy === -1 ? 0 : 1;
    }
    const b = i * 4;
    indices.set([b, b + 1, b + 2, b + 1, b + 3, b + 2], i * 6);
  });
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  geometry.setAttribute("color", new BufferAttribute(colors, 3));
  geometry.setAttribute("uv", new BufferAttribute(uvs, 2));
  geometry.setIndex(new BufferAttribute(indices, 1));
  const material = new MeshBasicMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    fog: false,
    vertexColors: true,
  });
  const mesh = new Mesh(geometry, material);
  mesh.frustumCulled = false;
  return { mesh, geometry, material };
}

export function createSky(seed: number): Sky {
  const group = new Group();
  const resources: Array<{ dispose(): void }> = [];
  const rand = mulberry32(seed ^ 0x5c1e5);

  const domeGeometry = new SphereGeometry(DOME_RADIUS_M, 32, 20);
  const domeMaterial = new ShaderMaterial({
    vertexShader: domeVertex,
    fragmentShader: domeFragment,
    uniforms: {
      uZenith: { value: ANIME.skyZenith },
      uMid: { value: ANIME.skyMid },
      uHorizon: { value: ANIME.skyHorizon },
      uGlow: { value: ANIME.sunGlow },
      uHaze: { value: ANIME.haze },
      uSunDir: { value: SUN_DIR },
    },
    side: BackSide,
    depthWrite: false,
    fog: false,
  });
  const dome = new Mesh(domeGeometry, domeMaterial);
  dome.renderOrder = -10;
  dome.frustumCulled = false;
  resources.push(domeGeometry, domeMaterial);
  group.add(dome);

  // The sun: one additive billboard at the glow's center.
  {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 128;
    const ctx = canvas.getContext("2d")!;
    const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 64);
    g.addColorStop(0, "rgba(255,246,225,1)");
    g.addColorStop(0.22, "rgba(255,220,168,0.85)");
    g.addColorStop(0.5, "rgba(246,168,126,0.32)");
    g.addColorStop(1, "rgba(246,168,126,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    const geometry = new PlaneGeometry(760, 760);
    const material = new MeshBasicMaterial({
      map: texture,
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
      fog: false,
    });
    const sun = new Mesh(geometry, material);
    sun.position.copy(SUN_DIR).multiplyScalar(SUN_DISTANCE_M);
    sun.lookAt(0, 0, 0);
    sun.renderOrder = -9;
    sun.frustumCulled = false;
    resources.push(geometry, material, texture);
    group.add(sun);
  }

  // Four unique painted cumulus, billboarded on the shell — the towering
  // stack near the sun's azimuth (the reference frame's lit cumulus), decks
  // and puffs ringing the horizon, no texture repeated side by side.
  const sunAz = Math.atan2(SUN_DIR.x, SUN_DIR.z);
  const textures = CLOUD_PROFILES.map((profile) => {
    const texture = new CanvasTexture(paintCloud(rand, profile));
    texture.colorSpace = SRGBColorSpace;
    resources.push(texture);
    return texture;
  });
  const placementsByProfile: Array<
    Array<{ az: number; el: number; w: number; hazeMix: number }>
  > = [
    // Towering: the hero stack by the sun, one echo far around.
    [
      { az: sunAz + 0.14, el: 0.3, w: 1150, hazeMix: 0 },
      { az: sunAz - 1.7, el: 0.36, w: 820, hazeMix: 0.08 },
    ],
    // Classic cumulus at mid elevations.
    [
      { az: sunAz - 0.62, el: 0.21, w: 820, hazeMix: 0.12 },
      { az: sunAz + 0.92, el: 0.26, w: 880, hazeMix: 0.1 },
      { az: sunAz + 2.4, el: 0.33, w: 850, hazeMix: 0.1 },
      { az: sunAz - 0.16, el: 0.5, w: 900, hazeMix: 0 },
    ],
    // Long decks hugging the horizon haze.
    [
      { az: sunAz - 1.15, el: 0.09, w: 1150, hazeMix: 0.35 },
      { az: sunAz + 1.5, el: 0.08, w: 1250, hazeMix: 0.4 },
      { az: sunAz - 2.3, el: 0.11, w: 1050, hazeMix: 0.45 },
      { az: sunAz + 2.95, el: 0.15, w: 980, hazeMix: 0.4 },
    ],
    // Small puffs scattered between.
    [
      { az: sunAz + 0.45, el: 0.14, w: 560, hazeMix: 0.28 },
      { az: sunAz - 1.05, el: 0.42, w: 520, hazeMix: 0.05 },
      { az: sunAz + 1.9, el: 0.18, w: 600, hazeMix: 0.3 },
    ],
  ];
  const cloudMeshes: Mesh[] = [];
  placementsByProfile.forEach((placements, i) => {
    const profile = CLOUD_PROFILES[i]!;
    const batch = cloudBatch(placements, textures[i]!, profile.w / profile.h);
    batch.mesh.renderOrder = -8;
    resources.push(batch.geometry, batch.material);
    cloudMeshes.push(batch.mesh);
    group.add(batch.mesh);
  });

  // The cirrus veil: two flat combed sheets hanging high overhead, seen at
  // the glancing angle real cirrus is — never tilted toward the camera.
  const cirrusTexture = new CanvasTexture(paintCirrus(rand));
  cirrusTexture.colorSpace = SRGBColorSpace;
  resources.push(cirrusTexture);
  const cirrusGroup = new Group();
  {
    // Both sheets baked into one geometry: one draw for the whole veil.
    const merged = new BufferGeometry();
    const sheets = [
      { az: sunAz - 0.4, dist: 1500, y: 1750, spin: 0.5 },
      { az: sunAz + 1.9, dist: 1900, y: 2050, spin: -0.9 },
    ];
    const positions = new Float32Array(sheets.length * 4 * 3);
    const uvs = new Float32Array(sheets.length * 4 * 2);
    const indices = new Uint16Array(sheets.length * 6);
    sheets.forEach((sheet, i) => {
      const cx = Math.sin(sheet.az) * sheet.dist;
      const cz = Math.cos(sheet.az) * sheet.dist;
      const cos = Math.cos(sheet.spin);
      const sin = Math.sin(sheet.spin);
      for (let v = 0; v < 4; v++) {
        const lx = (v % 2 === 0 ? -1 : 1) * 1300;
        const lz = (v < 2 ? -1 : 1) * 450;
        const o = (i * 4 + v) * 3;
        positions[o] = cx + lx * cos - lz * sin;
        positions[o + 1] = sheet.y;
        positions[o + 2] = cz + lx * sin + lz * cos;
        uvs[(i * 4 + v) * 2] = v % 2;
        uvs[(i * 4 + v) * 2 + 1] = v < 2 ? 0 : 1;
      }
      const b = i * 4;
      indices.set([b, b + 1, b + 2, b + 1, b + 3, b + 2], i * 6);
    });
    merged.setAttribute("position", new BufferAttribute(positions, 3));
    merged.setAttribute("uv", new BufferAttribute(uvs, 2));
    merged.setIndex(new BufferAttribute(indices, 1));
    const sheetMaterial = new MeshBasicMaterial({
      map: cirrusTexture,
      transparent: true,
      depthWrite: false,
      fog: false,
      opacity: 0.8,
      side: DoubleSide,
    });
    resources.push(merged, sheetMaterial);
    const veil = new Mesh(merged, sheetMaterial);
    veil.renderOrder = -9;
    veil.frustumCulled = false;
    cirrusGroup.add(veil);
    group.add(cirrusGroup);
  }

  // Scroll-linked drift: each layer slides its own amount, cirrus slowest —
  // a parallax of winds, driven only while the ride moves.
  const drift = (t: number) => {
    cloudMeshes[0]!.rotation.y = t * 0.05;
    cloudMeshes[1]!.rotation.y = t * -0.036;
    cloudMeshes[2]!.rotation.y = t * 0.024;
    cloudMeshes[3]!.rotation.y = t * -0.06;
    cirrusGroup.rotation.y = t * 0.014;
  };

  return { group, resources, drift };
}
