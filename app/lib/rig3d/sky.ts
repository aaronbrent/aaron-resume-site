import {
  AdditiveBlending,
  BackSide,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
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
 * The sky (PLAN-3D ADR-9, amended): a gradient dome, a low sun, and painterly
 * cumulus billboards — the anime-key vault the whole run rides under. The
 * group follows the camera's position (never rotation) like the far ridges,
 * so it is infinitely-far scenery for four draw calls: dome, sun, and two
 * merged cloud batches.
 *
 * The clouds are painted at init onto two small canvases (stacked radial
 * gradients: cream bodies, salmon underlight, a bright top rim) — authored
 * code, not fetched art, and deterministic from the content seed.
 */

const DOME_RADIUS_M = 3600;
const CLOUD_SHELL_M = 3250;
const SUN_DISTANCE_M = 3400;

export interface Sky {
  group: Group;
  /** Everything with a dispose(): geometries, materials, textures. */
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

/** Paint one cumulus onto a canvas: silhouette, underlight, top rim. */
function paintCloud(rand: () => number, wide: boolean): HTMLCanvasElement {
  const w = 256;
  const h = wide ? 128 : 176;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  const lit = `#${ANIME.cloudLit.getHexString()}`;
  const shade = ANIME.cloudShade;

  // Cauliflower cluster: many small puffs over a few anchors, taller in the
  // middle, tapered at the ends — the crisp lobed silhouette, not a blur.
  const puffs: Array<{ x: number; y: number; r: number }> = [];
  const count = wide ? 16 : 13;
  for (let i = 0; i < count; i++) {
    const f = i / (count - 1);
    const arch = Math.sin(f * Math.PI) ** 0.8;
    puffs.push({
      x: w * (0.1 + 0.8 * f + (rand() - 0.5) * 0.04),
      y: h * (0.78 - arch * (wide ? 0.26 : 0.42) * (0.55 + rand() * 0.45)),
      r: (wide ? 13 : 15) + arch * (wide ? 14 : 19) + rand() * 6,
    });
    // Filler row: keeps the body solid between the crown and the flat base.
    if (i > 0 && i < count - 1) {
      puffs.push({
        x: w * (0.12 + 0.76 * f + (rand() - 0.5) * 0.06),
        y: h * (0.74 - arch * 0.1),
        r: (wide ? 14 : 16) + arch * 10 + rand() * 5,
      });
    }
  }
  // A flat base bar keeps the underside level like real cumulus.
  for (const p of puffs) {
    const g = ctx.createRadialGradient(p.x, p.y, p.r * 0.55, p.x, p.y, p.r);
    g.addColorStop(0, lit);
    g.addColorStop(0.88, lit);
    g.addColorStop(1, `${lit}00`);
    ctx.fillStyle = g;
    ctx.fillRect(p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
  }
  ctx.fillStyle = lit;
  ctx.fillRect(w * 0.16, h * 0.74, w * 0.68, h * 0.06);
  // Sunset underlight: salmon pooled along the flat base.
  ctx.globalCompositeOperation = "source-atop";
  const s = `#${shade.getHexString()}`;
  const under = ctx.createLinearGradient(0, h * 0.4, 0, h * 0.84);
  under.addColorStop(0, `${s}00`);
  under.addColorStop(0.75, `${s}66`);
  under.addColorStop(1, `${s}cc`);
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

  // Two painted cloud variants, billboarded on the shell. The big stack sits
  // near the sun's azimuth (the reference frame's lit cumulus); smaller and
  // hazier ones ring the horizon.
  const sunAz = Math.atan2(SUN_DIR.x, SUN_DIR.z);
  const tall = new CanvasTexture(paintCloud(rand, false));
  const wide = new CanvasTexture(paintCloud(rand, true));
  tall.colorSpace = SRGBColorSpace;
  wide.colorSpace = SRGBColorSpace;
  resources.push(tall, wide);
  const tallPlacements = [
    { az: sunAz + 0.12, el: 0.3, w: 1150, hazeMix: 0 },
    { az: sunAz - 0.62, el: 0.2, w: 800, hazeMix: 0.12 },
    { az: sunAz + 0.9, el: 0.26, w: 880, hazeMix: 0.1 },
    { az: sunAz - 1.7, el: 0.38, w: 780, hazeMix: 0.05 },
    { az: sunAz + 2.4, el: 0.34, w: 850, hazeMix: 0.1 },
  ];
  const widePlacements = [
    { az: sunAz - 1.15, el: 0.09, w: 1100, hazeMix: 0.35 },
    { az: sunAz + 1.5, el: 0.08, w: 1200, hazeMix: 0.4 },
    { az: sunAz + 0.42, el: 0.12, w: 800, hazeMix: 0.3 },
    { az: sunAz - 2.3, el: 0.11, w: 1050, hazeMix: 0.45 },
    { az: sunAz + 2.95, el: 0.15, w: 950, hazeMix: 0.4 },
    { az: sunAz - 0.18, el: 0.5, w: 900, hazeMix: 0 },
  ];
  const tallBatch = cloudBatch(tallPlacements, tall, 256 / 176);
  const wideBatch = cloudBatch(widePlacements, wide, 256 / 128);
  tallBatch.mesh.renderOrder = -8;
  wideBatch.mesh.renderOrder = -8;
  resources.push(
    tallBatch.geometry,
    tallBatch.material,
    wideBatch.geometry,
    wideBatch.material,
  );
  group.add(tallBatch.mesh, wideBatch.mesh);

  return { group, resources };
}
