import {
  ConeGeometry,
  CylinderGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  Quaternion,
  Vector3,
} from "three";
import { emptyLineLutSample, sampleLineLut, type LineLut } from "~/lib/line/lut3d";
import { advanceByMeters } from "~/lib/world/junctions";
import { mergeColoredParts } from "./merge";
import { ANIME } from "./palette";

/**
 * Run dressing (PLAN-3D Phase G3): bamboo edge markers with patrol-orange
 * tips, planted every ~26 m along the groomed edge, alternating sides. They
 * live in the near field where the sensation of speed does — whipping past
 * in the rider's periphery — and they are honest resort furniture, not
 * decoration. Pole and tip bake into one geometry: one instanced draw.
 */

const SPACING_M = 26;
const POLE_H_M = 1.5;

export interface Furniture {
  group: Group;
  resources: Array<{ dispose(): void }>;
}

const smooth01 = (edge0: number, edge1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

export function createRunMarkers(
  lut: LineLut,
  heightAt: (x: number, z: number) => number,
): Furniture {
  const group = new Group();
  const resources: Array<{ dispose(): void }> = [];
  const sample = emptyLineLutSample();

  // Walk the line by meters, planting alternating-side markers at the
  // groomed apron's edge (the same width law the terrain builder grooms by).
  const spots: Array<{ x: number; z: number; lean: number }> = [];
  let t = 0.004;
  let side = 1;
  while (t < 0.992) {
    const s = sampleLineLut(lut, t, sample);
    const apron = 7 + 8 * (1 - smooth01(0.25, 0.8, s.speed));
    const rx = s.tan[2] * side;
    const rz = -s.tan[0] * side;
    const x = s.pos[0] + rx * (apron + 1.4);
    const z = s.pos[2] + rz * (apron + 1.4);
    spots.push({ x, z, lean: Math.sin(t * 517) * 0.06 });
    side = -side;
    const next = advanceByMeters(lut, t, SPACING_M, sample);
    if (next <= t) break;
    t = next;
  }

  const poleGeometry = new CylinderGeometry(0.028, 0.042, POLE_H_M, 5);
  poleGeometry.translate(0, POLE_H_M / 2, 0);
  const tipGeometry = new ConeGeometry(0.085, 0.24, 5);
  tipGeometry.translate(0, POLE_H_M + 0.08, 0);
  const markerGeometry = mergeColoredParts([
    { geometry: poleGeometry, color: ANIME.bamboo },
    { geometry: tipGeometry, color: ANIME.patrol },
  ]);
  const material = new MeshBasicMaterial({ vertexColors: true });
  resources.push(markerGeometry, material);

  const markers = new InstancedMesh(markerGeometry, material, spots.length);
  const m = new Matrix4();
  const q = new Quaternion();
  const pos = new Vector3();
  const unit = new Vector3(1, 1, 1);
  const axis = new Vector3();
  spots.forEach((spot, i) => {
    axis.set(Math.sin(spot.lean * 40), 0, Math.cos(spot.lean * 40)).normalize();
    q.setFromAxisAngle(axis, spot.lean);
    pos.set(spot.x, heightAt(spot.x, spot.z) - 0.12, spot.z);
    m.compose(pos, q, unit);
    markers.setMatrixAt(i, m);
  });
  markers.instanceMatrix.needsUpdate = true;
  group.add(markers);
  return { group, resources };
}
