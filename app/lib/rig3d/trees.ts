import {
  BufferAttribute,
  BufferGeometry,
  Color,
  Group,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  Quaternion,
  Vector3,
} from "three";
import type { TreePlacement } from "~/lib/world/scatter";
import { ANIME, SUN_DIR } from "./palette";

/**
 * The forest, rendered (PLAN-3D Phase G1): four merged spruce archetypes —
 * jittered canopy tiers, snow caps on every tier, a stub of trunk, and an
 * underside skirt — each a single vertex-colored geometry, so the whole
 * treeline costs one instanced draw per archetype. The golden-hour light is
 * baked per face (sun-side spruce warms, shade side goes blue), which is why
 * instances never yaw-spin: silhouette variety comes from archetype choice,
 * non-uniform scale, and a small storm lean instead, and the light stays
 * honest on every tree.
 */

export const TREE_ARCHETYPES = 4;

export interface Forest {
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

const smooth01 = (edge0: number, edge1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

interface ArchetypeSpec {
  tiers: number;
  spokes: number;
  /** Canopy breadth multiplier — storm-broad vs. alpine-slim. */
  breadth: number;
  /** How far tier centers wander off the trunk axis. */
  crook: number;
  /** Snow-cap coverage dial ∈ [0,1]. */
  snow: number;
}

/** Four silhouettes: broad storm spruce, the classic, alpine slim, crooked elder. */
const SPECS: ArchetypeSpec[] = [
  { tiers: 3, spokes: 5, breadth: 1.2, crook: 0.05, snow: 0.95 },
  { tiers: 4, spokes: 6, breadth: 1.0, crook: 0.03, snow: 0.75 },
  { tiers: 4, spokes: 5, breadth: 0.78, crook: 0.02, snow: 0.6 },
  { tiers: 5, spokes: 6, breadth: 0.92, crook: 0.07, snow: 0.85 },
];

type FaceKind = "spruce" | "snow" | "trunk" | "under";

/**
 * One spruce archetype: unit height (base y=0, tip y≈1), face-flat colors
 * with the sun baked in. Non-indexed so every facet keeps its own paint.
 */
function buildSpruce(spec: ArchetypeSpec, seed: number): BufferGeometry {
  const rand = mulberry32(seed);
  const positions: number[] = [];
  const colors: number[] = [];
  const face = new Color();

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
    kind: FaceKind,
  ) => {
    const ux = bx - ax;
    const uy = by - ay;
    const uz = bz - az;
    const wx = cx - ax;
    const wy = cy - ay;
    const wz = cz - az;
    let nx = uy * wz - uz * wy;
    let ny = uz * wx - ux * wz;
    let nz = ux * wy - uy * wx;
    const len = Math.hypot(nx, ny, nz) || 1;
    nx /= len;
    ny /= len;
    nz /= len;
    const lit = smooth01(-0.2, 0.75, nx * SUN_DIR.x + ny * SUN_DIR.y + nz * SUN_DIR.z);
    if (kind === "spruce") {
      face.copy(ANIME.spruceShade).lerp(ANIME.spruceLit, lit);
    } else if (kind === "snow") {
      face.copy(ANIME.snowShade).lerp(ANIME.snowLit, 0.25 + 0.75 * lit);
    } else if (kind === "trunk") {
      face.copy(ANIME.trunk).multiplyScalar(0.7 + 0.6 * lit);
    } else {
      face.copy(ANIME.spruceShade).multiplyScalar(0.55);
    }
    positions.push(ax, ay, az, bx, by, bz, cx, cy, cz);
    for (let v = 0; v < 3; v++) colors.push(face.r, face.g, face.b);
  };

  // Trunk stub: visible below the lowest tier, five flat sides.
  {
    const sides = 5;
    const r0 = 0.05;
    const r1 = 0.03;
    const top = 0.2;
    for (let s = 0; s < sides; s++) {
      const a0 = (s / sides) * Math.PI * 2;
      const a1 = ((s + 1) / sides) * Math.PI * 2;
      const x0 = Math.sin(a0);
      const z0 = Math.cos(a0);
      const x1 = Math.sin(a1);
      const z1 = Math.cos(a1);
      pushTri(x0 * r0, 0, z0 * r0, x1 * r0, 0, z1 * r0, x1 * r1, top, z1 * r1, "trunk");
      pushTri(x0 * r0, 0, z0 * r0, x1 * r1, top, z1 * r1, x0 * r1, top, z0 * r1, "trunk");
    }
  }

  // Canopy tiers, bottom to top. Each tier is a jittered cone with a snow cap
  // cone nested on its upper half; tier centers wander for the crook.
  let crookX = 0;
  let crookZ = 0;
  for (let tier = 0; tier < spec.tiers; tier++) {
    const f = tier / (spec.tiers - 1);
    const ringY = 0.1 + 0.56 * f;
    const apexY = tier === spec.tiers - 1 ? 1 : ringY + (1 - ringY) * 0.58;
    const radius = spec.breadth * (0.34 - 0.22 * f);
    crookX += (rand() - 0.5) * spec.crook;
    crookZ += (rand() - 0.5) * spec.crook;
    const phase = rand() * Math.PI * 2;

    // Jittered ring, shared by the green skirt and the snow cap above it.
    const ring: Array<[number, number, number]> = [];
    for (let s = 0; s < spec.spokes; s++) {
      const a = phase + (s / spec.spokes) * Math.PI * 2;
      const jr = radius * (0.82 + rand() * 0.36);
      ring.push([
        crookX + Math.sin(a) * jr,
        ringY + (rand() - 0.5) * 0.035,
        crookZ + Math.cos(a) * jr,
      ]);
    }
    const snowR = 0.45 + 0.25 * spec.snow;
    for (let s = 0; s < spec.spokes; s++) {
      const [x0, y0, z0] = ring[s]!;
      const [x1, y1, z1] = ring[(s + 1) % spec.spokes]!;
      pushTri(x0, y0, z0, x1, y1, z1, crookX, apexY, crookZ, "spruce");
      // The snow cap: a nested shallower cone over the tier's shoulders.
      const sy = ringY + (apexY - ringY) * (1 - snowR) * 0.55;
      pushTri(
        crookX + (x0 - crookX) * snowR,
        sy + (y0 - ringY) * snowR,
        crookZ + (z0 - crookZ) * snowR,
        crookX + (x1 - crookX) * snowR,
        sy + (y1 - ringY) * snowR,
        crookZ + (z1 - crookZ) * snowR,
        crookX,
        apexY + 0.015,
        crookZ,
        "snow",
      );
    }
    // Underside skirt on the bottom tier only — the one seen from below.
    if (tier === 0) {
      for (let s = 0; s < spec.spokes; s++) {
        const [x0, y0, z0] = ring[s]!;
        const [x1, y1, z1] = ring[(s + 1) % spec.spokes]!;
        pushTri(x1, y1, z1, x0, y0, z0, crookX, ringY - 0.03, crookZ, "under");
      }
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute("color", new BufferAttribute(new Float32Array(colors), 3));
  geometry.computeBoundingSphere();
  return geometry;
}

/**
 * Instance the scattered placements into one draw per archetype. Trees sink
 * slightly into the snow (deeper for tall trees — drifted-in trunks), and
 * instance color carries a subtle per-tree lightness/temperature shift.
 */
export function createForest(
  trees: readonly TreePlacement[],
  heightAt: (x: number, z: number) => number,
  seed: number,
): Forest {
  const group = new Group();
  const resources: Array<{ dispose(): void }> = [];
  const material = new MeshBasicMaterial({ vertexColors: true });
  resources.push(material);

  const byArchetype: TreePlacement[][] = Array.from({ length: SPECS.length }, () => []);
  for (const tree of trees) byArchetype[tree.archetype % SPECS.length]!.push(tree);

  const m = new Matrix4();
  const q = new Quaternion();
  const pos = new Vector3();
  const scale = new Vector3();
  const axis = new Vector3();
  const tint = new Color();
  SPECS.forEach((spec, index) => {
    const members = byArchetype[index]!;
    if (members.length === 0) return;
    const geometry = buildSpruce(spec, seed ^ (0x1f3a + index * 0x9e77));
    resources.push(geometry);
    const mesh = new InstancedMesh(geometry, material, members.length);
    members.forEach((tree, i) => {
      const ground = heightAt(tree.x, tree.z);
      axis.set(Math.sin(tree.leanDir), 0, Math.cos(tree.leanDir));
      q.setFromAxisAngle(axis, tree.lean);
      pos.set(tree.x, ground - 0.12 - tree.heightM * 0.04, tree.z);
      scale.set(tree.heightM * tree.width, tree.heightM, tree.heightM * tree.width);
      m.compose(pos, q, scale);
      mesh.setMatrixAt(i, m);
      // Subtle per-tree paint: lightness wobble, a whisper of temperature.
      tint
        .setRGB(1, 1, 1)
        .offsetHSL(tree.tint * 0.012, tree.tint * 0.04, tree.tint * 0.045);
      mesh.setColorAt(i, tint);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    group.add(mesh);
  });

  return { group, resources };
}
