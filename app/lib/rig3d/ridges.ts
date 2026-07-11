import {
  BufferAttribute,
  BufferGeometry,
  Color,
  Group,
  Mesh,
  MeshBasicMaterial,
} from "three";
import { createNoise2D, fbm } from "~/lib/world/noise";
import { ANIME, SUN_DIR } from "./palette";

/**
 * The distance (PLAN-3D ADR-9, amended): three painted mountain ranges ring
 * the camera — snow crests, alpenglow on the sun side, each layer dissolving
 * further into haze — and a world-anchored hero massif stands down-valley at
 * true distance, so descending the run parallaxes against it. The rings carve
 * a notch toward +z (the fall line) so the vista into the valley stays open;
 * the massif lives in that notch, under the sun.
 *
 * Rings follow the camera's position (never rotation) each frame; the massif
 * never moves. Everything is unfogged and pre-hazed: haze is painted into the
 * vertex colors, matched to the fog the real terrain wears.
 */

interface Painted {
  group: Group;
  resources: Array<{ dispose(): void }>;
}

const SUN_AZ = Math.atan2(SUN_DIR.x, SUN_DIR.z);

const wrapAngle = (a: number) =>
  a > Math.PI ? a - 2 * Math.PI : a < -Math.PI ? a + 2 * Math.PI : a;

const smooth01 = (edge0: number, edge1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

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

interface RingLayer {
  radius: number;
  baseY: number;
  peakMinY: number;
  peakMaxY: number;
  hazeMix: number;
  /** Vista notch toward +z: half-width (radians) and how deep peaks drop. */
  notchWidth: number;
  notchDepth: number;
  seed: number;
}

/**
 * One range ring: three vertex rows per segment (haze base, rock shoulder,
 * snow crest), colored in place — silhouette geometry that reads as a painted
 * range, for one draw call.
 */
function rangeRing(layer: RingLayer, renderOrder: number): Mesh {
  const segments = 160;
  const noise = createNoise2D(layer.seed);
  const rows = 3;
  const positions = new Float32Array((segments + 1) * rows * 3);
  const colors = new Float32Array((segments + 1) * rows * 3);
  const base = new Color();
  const shoulder = new Color();
  const crest = new Color();
  for (let s = 0; s <= segments; s++) {
    const az = (s / segments) * Math.PI * 2 - Math.PI;
    const cx = Math.sin(az);
    const sz = Math.cos(az);
    // Ridged relief sampled on the circle stays seamless at the wrap.
    const ridged = 1 - Math.abs(fbm(noise, cx * 2.2, sz * 2.2, 4));
    let relief = smooth01(0.25, 1, ridged);
    // The vista notch: peaks bow out of the way of the valley view — full
    // cut dead ahead, easing back to full relief at the notch's edge.
    const notch = 1 - smooth01(layer.notchWidth * 0.35, layer.notchWidth, Math.abs(az));
    relief *= 1 - layer.notchDepth * notch;
    const peakY = layer.peakMinY + relief * (layer.peakMaxY - layer.peakMinY);
    const x = cx * layer.radius;
    const z = sz * layer.radius;

    // Alpenglow on the sun side; the biggest crests catch the most.
    const sunFace = smooth01(-0.2, 1, Math.cos(wrapAngle(az - SUN_AZ)));
    const warm = sunFace * (0.25 + 0.75 * relief);
    base.copy(ANIME.haze);
    shoulder
      .copy(ANIME.rangeRock)
      .lerp(ANIME.rangeWarm, warm * 0.45)
      .lerp(ANIME.haze, layer.hazeMix);
    crest
      .copy(ANIME.rangeSnow)
      .lerp(ANIME.rangeWarm, warm * 0.55)
      .lerp(ANIME.haze, layer.hazeMix * 0.85);

    const shoulderY = layer.baseY + (peakY - layer.baseY) * (0.42 + 0.1 * relief);
    const ys = [layer.baseY, shoulderY, peakY];
    const cs = [base, shoulder, crest];
    for (let r = 0; r < rows; r++) {
      const o = (s * rows + r) * 3;
      positions[o] = x;
      positions[o + 1] = ys[r]!;
      positions[o + 2] = z;
      colors[o] = cs[r]!.r;
      colors[o + 1] = cs[r]!.g;
      colors[o + 2] = cs[r]!.b;
    }
  }
  const indices = new Uint32Array(segments * (rows - 1) * 6);
  let k = 0;
  for (let s = 0; s < segments; s++) {
    for (let r = 0; r < rows - 1; r++) {
      const a = s * rows + r;
      const b = a + rows;
      indices[k++] = a;
      indices[k++] = a + 1;
      indices[k++] = b;
      indices[k++] = a + 1;
      indices[k++] = b + 1;
      indices[k++] = b;
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  geometry.setAttribute("color", new BufferAttribute(colors, 3));
  geometry.setIndex(new BufferAttribute(indices, 1));
  const mesh = new Mesh(
    geometry,
    new MeshBasicMaterial({
      vertexColors: true,
      fog: false,
      depthWrite: false,
    }),
  );
  mesh.renderOrder = renderOrder;
  mesh.frustumCulled = false;
  return mesh;
}

/** Three range rings, nearest last so it paints over the layers behind it. */
export function createRidges(seed: number): Painted {
  const group = new Group();
  const resources: Array<{ dispose(): void }> = [];
  const layers: RingLayer[] = [
    {
      radius: 1020,
      baseY: -300,
      peakMinY: 40,
      peakMaxY: 235,
      hazeMix: 0.66,
      notchWidth: 0.4,
      notchDepth: 0.72,
      seed: seed ^ 0x71d6e,
    },
    {
      radius: 760,
      baseY: -280,
      peakMinY: 0,
      peakMaxY: 185,
      hazeMix: 0.42,
      notchWidth: 0.56,
      notchDepth: 0.85,
      seed: seed ^ 0x2b,
    },
    {
      radius: 520,
      baseY: -250,
      peakMinY: -40,
      peakMaxY: 130,
      hazeMix: 0.16,
      notchWidth: 0.7,
      notchDepth: 0.95,
      seed: seed ^ 0x9c41,
    },
  ];
  layers.forEach((layer, i) => {
    const mesh = rangeRing(layer, -3 + i);
    resources.push(mesh.geometry, mesh.material as MeshBasicMaterial);
    group.add(mesh);
  });
  return { group, resources };
}

/**
 * The hero massif: a cluster of jagged peaks standing in the valley notch at
 * real distance — warm rock toward the sun, blue-violet shadow away from it,
 * snow on the ledges and caps. One non-indexed mesh, flat face colors, one
 * draw call.
 */
export function createMassif(seed: number): Painted {
  const rand = mulberry32(seed ^ 0x3a55f);
  const peaks: Array<{
    cx: number;
    cz: number;
    baseY: number;
    height: number;
    radius: number;
    haze: number;
  }> = [];
  // The centerpiece under the sun, flanked by supports stepping into haze.
  const anchors = [
    { cx: 470, cz: 2320, height: 760, radius: 290, haze: 0.16 },
    { cx: 220, cz: 2260, height: 500, radius: 220, haze: 0.2 },
    { cx: 730, cz: 2420, height: 560, radius: 240, haze: 0.24 },
    { cx: 40, cz: 2500, height: 420, radius: 200, haze: 0.34 },
    { cx: 980, cz: 2580, height: 450, radius: 210, haze: 0.38 },
    { cx: 600, cz: 2700, height: 600, radius: 250, haze: 0.42 },
  ];
  for (const a of anchors) {
    peaks.push({
      cx: a.cx + (rand() - 0.5) * 60,
      cz: a.cz + (rand() - 0.5) * 60,
      baseY: 60,
      height: a.height * (0.92 + rand() * 0.16),
      radius: a.radius,
      haze: a.haze,
    });
  }

  const spokes = 9;
  const trisPerPeak = spokes * 3; // base→mid quads (2) + mid→apex (1)
  const positions = new Float32Array(peaks.length * trisPerPeak * 9);
  const colors = new Float32Array(peaks.length * trisPerPeak * 9);
  const faceColor = new Color();
  let v = 0;

  const pushTri = (
    ax: number,
    ay: number,
    az: number,
    bx: number,
    by: number,
    bz: number,
    cx: number,
    cy: number,
    cz: number,
    haze: number,
    capMix: number,
  ) => {
    // Flat face normal → sun side or shadow side; ledges and caps hold snow.
    const ux = bx - ax,
      uy = by - ay,
      uz = bz - az;
    const wx = cx - ax,
      wy = cy - ay,
      wz = cz - az;
    let nx = uy * wz - uz * wy;
    let ny = uz * wx - ux * wz;
    let nz = ux * wy - uy * wx;
    const len = Math.hypot(nx, ny, nz) || 1;
    nx /= len;
    ny /= len;
    nz /= len;
    const sun = nx * SUN_DIR.x + ny * SUN_DIR.y + nz * SUN_DIR.z;
    const litMix = smooth01(-0.05, 0.6, sun);
    const snow = Math.min(1, smooth01(0.55, 0.78, ny) + capMix);
    // Higher faces climb out of the valley haze.
    const midY = (ay + by + cy) / 3;
    const heightHaze = haze * (1 - 0.55 * smooth01(150, 550, midY));
    faceColor
      .copy(ANIME.rockShade)
      .lerp(ANIME.rockLit, litMix)
      .lerp(ANIME.rangeSnow, snow * (0.45 + 0.55 * litMix))
      .lerp(ANIME.rangeWarm, litMix * snow * 0.4)
      .lerp(ANIME.haze, heightHaze);
    for (const [px, py, pz] of [
      [ax, ay, az],
      [bx, by, bz],
      [cx, cy, cz],
    ] as const) {
      positions[v] = px;
      positions[v + 1] = py;
      positions[v + 2] = pz;
      colors[v] = faceColor.r;
      colors[v + 1] = faceColor.g;
      colors[v + 2] = faceColor.b;
      v += 3;
    }
  };

  for (const peak of peaks) {
    // Jagged base and mid rings, then a slightly wandering apex.
    const baseR: number[] = [];
    const midR: number[] = [];
    const midY: number[] = [];
    for (let s = 0; s < spokes; s++) {
      baseR.push(peak.radius * (0.8 + rand() * 0.45));
      midR.push(peak.radius * (0.3 + rand() * 0.22));
      midY.push(peak.baseY + peak.height * (0.48 + rand() * 0.18));
    }
    const apexX = peak.cx + (rand() - 0.5) * peak.radius * 0.18;
    const apexZ = peak.cz + (rand() - 0.5) * peak.radius * 0.18;
    const apexY = peak.baseY + peak.height;
    for (let s = 0; s < spokes; s++) {
      const a0 = (s / spokes) * Math.PI * 2;
      const a1 = ((s + 1) / spokes) * Math.PI * 2;
      const b0x = peak.cx + Math.sin(a0) * baseR[s]!;
      const b0z = peak.cz + Math.cos(a0) * baseR[s]!;
      const b1x = peak.cx + Math.sin(a1) * baseR[(s + 1) % spokes]!;
      const b1z = peak.cz + Math.cos(a1) * baseR[(s + 1) % spokes]!;
      const m0x = peak.cx + Math.sin(a0) * midR[s]!;
      const m0z = peak.cz + Math.cos(a0) * midR[s]!;
      const m1x = peak.cx + Math.sin(a1) * midR[(s + 1) % spokes]!;
      const m1z = peak.cz + Math.cos(a1) * midR[(s + 1) % spokes]!;
      const m0y = midY[s]!;
      const m1y = midY[(s + 1) % spokes]!;
      pushTri(b0x, peak.baseY, b0z, b1x, peak.baseY, b1z, m0x, m0y, m0z, peak.haze, 0);
      pushTri(b1x, peak.baseY, b1z, m1x, m1y, m1z, m0x, m0y, m0z, peak.haze, 0);
      pushTri(m0x, m0y, m0z, m1x, m1y, m1z, apexX, apexY, apexZ, peak.haze, 0.28);
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  geometry.setAttribute("color", new BufferAttribute(colors, 3));
  geometry.computeBoundingSphere();
  const material = new MeshBasicMaterial({
    vertexColors: true,
    fog: false,
    depthWrite: false,
  });
  const mesh = new Mesh(geometry, material);
  mesh.renderOrder = -4;
  const group = new Group();
  group.add(mesh);
  return { group, resources: [geometry, material] };
}
