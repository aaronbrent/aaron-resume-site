import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  ConeGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  Quaternion,
  Vector3,
} from "three";
import { closedTrail } from "~/content/closed-trail";
import { waypoints } from "~/content/waypoints";
import { emptyLineLutSample, sampleLineLut, type LineLut } from "~/lib/line/lut3d";
import { advanceByMeters, type ForkBranch } from "~/lib/world/junctions";
import { mergeColoredParts } from "./merge";
import { ANIME } from "./palette";

/**
 * Resort trail signs (PLAN-3D ADR-8, Phase C; furniture upgraded in Phase
 * G3): full-size furniture at every career junction and at the closed trail
 * — two timber posts, cross-braces, a navy board under a snow-capped gable
 * roof, and drifted snow mounds at the post feet — standing on the groomed
 * bench at the waypoint's side of the fork, canted to face the arriving
 * rider. Junction decoys get a smaller single-post wayfinding board so the
 * untaken trail reads as a real choice. The whole kit bakes into one
 * vertex-colored geometry per variant (merge.ts), so signage costs two
 * instanced draws total.
 *
 * The words never live in the geometry: each board exports a placement the
 * DOM sign layer projects real text onto (signs-layer.ts), so the content
 * stays selectable, crisp, and translated — never a texture.
 */

export const SIGN_BOARD_W_M = 3.4;
export const SIGN_BOARD_H_M = 2.1;
/** Board center height above the bench snow. */
const BOARD_CENTER_Y_M = 2.6;
const STANDOFF_M = 7;
const BOARD_NAVY = new Color("#22344d");

export interface SignPlacement {
  id: string;
  /** Ride time of the sign's read zone (the content anchor). */
  t: number;
  /** Board face center, world meters — pushed just off the board's front. */
  center: [number, number, number];
  /** Rotation about +y; the face normal points back up the approach. */
  yaw: number;
}

export interface Signs {
  group: Group;
  resources: Array<{ dispose(): void }>;
  placements: SignPlacement[];
}

const signContent = [
  ...waypoints.map((w) => ({ id: w.id, t: w.t, side: w.side })),
  { id: closedTrail.id, t: closedTrail.t, side: "left" as const },
];

/** Unit gable prism: eaves at y=0, ridge at y=1, ridge running along z. */
function gableGeometry(): BufferGeometry {
  // prettier-ignore
  const tris = [
    -0.5, 0, -0.5,  0.5, 0, -0.5,  0, 1, -0.5,
    0.5, 0, 0.5,  -0.5, 0, 0.5,  0, 1, 0.5,
    -0.5, 0, -0.5,  0, 1, -0.5,  0, 1, 0.5,
    -0.5, 0, -0.5,  0, 1, 0.5,  -0.5, 0, 0.5,
    0.5, 0, -0.5,  0.5, 0, 0.5,  0, 1, 0.5,
    0.5, 0, -0.5,  0, 1, 0.5,  0, 1, -0.5,
  ];
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(new Float32Array(tris), 3));
  return geometry;
}

/** The full trail-sign kit in its local frame: origin at ground center. */
function signKitGeometry(): BufferGeometry {
  const parts: Array<{ geometry: BufferGeometry; color: Color }> = [];
  const spread = SIGN_BOARD_W_M / 2 - 0.35;
  for (const side of [-1, 1] as const) {
    const post = new BoxGeometry(0.2, 3.5, 0.2);
    post.translate(side * spread, 1.75, 0);
    parts.push({ geometry: post, color: ANIME.wood });
    const brace = new BoxGeometry(0.09, 1.35, 0.09);
    brace.rotateZ(side * 0.52);
    brace.translate(side * spread * 0.65, 0.85, 0);
    parts.push({ geometry: brace, color: ANIME.wood });
    const mound = new ConeGeometry(1.0, 0.46, 7);
    mound.scale(side < 0 ? 1.0 : 1.3, 1, side < 0 ? 1.15 : 0.9);
    mound.translate(side * spread, 0.12, 0);
    parts.push({ geometry: mound, color: ANIME.snowDust });
  }
  const board = new BoxGeometry(SIGN_BOARD_W_M, SIGN_BOARD_H_M, 0.12);
  board.translate(0, BOARD_CENTER_Y_M, 0);
  parts.push({ geometry: board, color: BOARD_NAVY });
  const roof = gableGeometry();
  roof.scale(SIGN_BOARD_W_M + 0.42, 0.4, 0.56);
  roof.translate(0, BOARD_CENTER_Y_M + SIGN_BOARD_H_M / 2 + 0.02, 0);
  parts.push({ geometry: roof, color: ANIME.snowDust });
  return mergeColoredParts(parts);
}

/** The decoy wayfinding kit: one short post, a small board, a snow cap. */
function decoyKitGeometry(): BufferGeometry {
  const parts: Array<{ geometry: BufferGeometry; color: Color }> = [];
  const post = new BoxGeometry(0.2, 3.5, 0.2);
  post.translate(0, 1.75, 0);
  post.scale(0.8, 0.62, 0.8);
  parts.push({ geometry: post, color: ANIME.wood });
  const board = new BoxGeometry(SIGN_BOARD_W_M, SIGN_BOARD_H_M, 0.12);
  board.scale(0.42, 0.34, 1);
  board.translate(0, 1.62, 0);
  parts.push({ geometry: board, color: BOARD_NAVY });
  const roof = gableGeometry();
  roof.scale(SIGN_BOARD_W_M * 0.42 + 0.3, 0.24, 0.42);
  roof.translate(0, 1.62 + (SIGN_BOARD_H_M * 0.34) / 2 + 0.02, 0);
  parts.push({ geometry: roof, color: ANIME.snowDust });
  return mergeColoredParts(parts);
}

export function createSigns(lut: LineLut, branches: readonly ForkBranch[] = []): Signs {
  const group = new Group();
  const resources: Array<{ dispose(): void }> = [];
  const placements: SignPlacement[] = [];

  const material = new MeshBasicMaterial({ vertexColors: true });
  const kitGeometry = signKitGeometry();
  resources.push(material, kitGeometry);
  const kits = new InstancedMesh(kitGeometry, material, signContent.length);

  const sample = emptyLineLutSample();
  const m = new Matrix4();
  const q = new Quaternion();
  const pos = new Vector3();
  const unit = new Vector3(1, 1, 1);
  const up = new Vector3(0, 1, 0);

  signContent.forEach((sign, i) => {
    // Stand the sign down-track of the anchor so it faces the rider through
    // the whole dwell — including a deep-link landing, which parks ~20 m past
    // the anchor (the 38%-viewport camera line): the board still waits ahead.
    const standT = advanceByMeters(lut, sign.t, 34, sample);
    const s = sampleLineLut(lut, standT, sample);
    // Stand on the groomed apron, on the waypoint's content side. Looking
    // down-mountain (+z), world +x reads as screen-left, so "right" is -x.
    const sideSign = sign.side === "right" ? -1 : 1;
    const rx = s.tan[2] * sideSign;
    const rz = -s.tan[0] * sideSign;
    const x = s.pos[0] + rx * STANDOFF_M;
    const z = s.pos[2] + rz * STANDOFF_M;
    const ground = s.pos[1] - 0.4;
    // Face back up the approach, canted a touch toward the trail.
    const yaw = Math.atan2(-s.tan[0], -s.tan[2]) - sideSign * 0.16;
    q.setFromAxisAngle(up, yaw);
    pos.set(x, ground, z);
    m.compose(pos, q, unit);
    kits.setMatrixAt(i, m);

    // The DOM panel floats just off the board's front face.
    const fx = Math.sin(yaw);
    const fz = Math.cos(yaw);
    placements.push({
      id: sign.id,
      t: sign.t,
      center: [x + fx * 0.09, ground + BOARD_CENTER_Y_M, z + fz * 0.09],
      yaw,
    });
  });
  kits.instanceMatrix.needsUpdate = true;
  group.add(kits);

  // Decoy wayfinding boards: one short post and a small blank board at each
  // untaken fork, angled to face the arriving rider — the road not taken,
  // labeled the way resorts label it.
  if (branches.length > 0) {
    const decoyGeometry = decoyKitGeometry();
    resources.push(decoyGeometry);
    const decoys = new InstancedMesh(decoyGeometry, material, branches.length);
    branches.forEach((b, i) => {
      const along = 14;
      const aside = 4.6;
      const x = b.x0 + b.dirX * along + b.dirZ * aside;
      const z = b.z0 + b.dirZ * along - b.dirX * aside;
      const ground = b.y0 - b.slope * along - 0.4;
      const yaw = Math.atan2(-b.dirX, -b.dirZ) + 0.12;
      q.setFromAxisAngle(up, yaw);
      pos.set(x, ground, z);
      m.compose(pos, q, unit);
      decoys.setMatrixAt(i, m);
    });
    decoys.instanceMatrix.needsUpdate = true;
    group.add(decoys);
  }

  return { group, resources, placements };
}
