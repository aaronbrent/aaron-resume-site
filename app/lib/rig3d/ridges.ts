import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
} from "three";
import { createNoise2D, fbm } from "~/lib/world/noise";

/**
 * Far-ridge silhouettes (PLAN-3D ADR-9): the printed map's layered ridgelines
 * as jagged rings around the camera, past the fog, unfogged and depth-silent
 * so the real terrain always wins. The group follows the camera's position
 * (never its rotation) each frame — infinitely-far scenery for the cost of
 * two draw calls.
 */

export interface RidgeLayer {
  radius: number;
  color: Color;
  /** Silhouette band, relative to camera height. */
  baseY: number;
  peakMinY: number;
  peakMaxY: number;
  seed: number;
}

function ridgeMesh(layer: RidgeLayer, renderOrder: number): Mesh {
  const segments = 128;
  const noise = createNoise2D(layer.seed);
  const positions = new Float32Array((segments + 1) * 2 * 3);
  for (let s = 0; s <= segments; s++) {
    const angle = (s / segments) * Math.PI * 2;
    // Sampling on the circle keeps the silhouette seamless at the wrap.
    const cx = Math.cos(angle);
    const sz = Math.sin(angle);
    const relief = fbm(noise, cx * 1.8, sz * 1.8, 3) * 0.5 + 0.5;
    const peak = layer.peakMinY + relief * (layer.peakMaxY - layer.peakMinY);
    const x = cx * layer.radius;
    const z = sz * layer.radius;
    positions[s * 6] = x;
    positions[s * 6 + 1] = layer.baseY;
    positions[s * 6 + 2] = z;
    positions[s * 6 + 3] = x;
    positions[s * 6 + 4] = peak;
    positions[s * 6 + 5] = z;
  }
  const indices = new Uint32Array(segments * 6);
  for (let s = 0; s < segments; s++) {
    const a = s * 2;
    indices[s * 6] = a;
    indices[s * 6 + 1] = a + 1;
    indices[s * 6 + 2] = a + 2;
    indices[s * 6 + 3] = a + 1;
    indices[s * 6 + 4] = a + 3;
    indices[s * 6 + 5] = a + 2;
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  geometry.setIndex(new BufferAttribute(indices, 1));
  const mesh = new Mesh(
    geometry,
    new MeshBasicMaterial({
      color: layer.color,
      fog: false,
      depthWrite: false,
      side: DoubleSide,
    }),
  );
  mesh.renderOrder = renderOrder;
  mesh.frustumCulled = false;
  return mesh;
}

/** Two silhouette layers; dispose via the returned group's children. */
export function createRidges(
  paper: Color,
  ink: Color,
  farM: number,
  seed: number,
): Group {
  const group = new Group();
  const far = new Color().copy(paper).lerp(ink, 0.08);
  const near = new Color().copy(paper).lerp(ink, 0.14);
  group.add(
    ridgeMesh(
      {
        radius: farM * 0.92,
        color: far,
        baseY: -60,
        peakMinY: 4,
        peakMaxY: 34,
        seed: seed ^ 0x71d6e,
      },
      -2,
    ),
  );
  group.add(
    ridgeMesh(
      {
        radius: farM * 0.78,
        color: near,
        baseY: -60,
        peakMinY: -8,
        peakMaxY: 22,
        seed: seed ^ 0x2b,
      },
      -1,
    ),
  );
  return group;
}
