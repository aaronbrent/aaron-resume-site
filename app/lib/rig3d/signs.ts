import {
  BoxGeometry,
  Color,
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
import { advanceByMeters } from "~/lib/world/junctions";
import { ANIME } from "./palette";

/**
 * Resort trail signs (PLAN-3D ADR-8, Phase C): full-size furniture at every
 * career junction and at the closed trail — two timber posts, a navy board,
 * snow on the header — standing on the groomed bench at the waypoint's side
 * of the fork, canted to face the arriving rider. Three instanced draws.
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

export function createSigns(lut: LineLut): Signs {
  const group = new Group();
  const resources: Array<{ dispose(): void }> = [];
  const placements: SignPlacement[] = [];

  const postGeometry = new BoxGeometry(0.2, 3.5, 0.2);
  postGeometry.translate(0, 1.75, 0);
  const boardGeometry = new BoxGeometry(SIGN_BOARD_W_M, SIGN_BOARD_H_M, 0.12);
  const capGeometry = new BoxGeometry(SIGN_BOARD_W_M + 0.24, 0.14, 0.3);
  const postMaterial = new MeshBasicMaterial({ color: ANIME.wood });
  const boardMaterial = new MeshBasicMaterial({ color: new Color("#22344d") });
  const capMaterial = new MeshBasicMaterial({ color: ANIME.snowDust });
  resources.push(postGeometry, boardGeometry, capGeometry);
  resources.push(postMaterial, boardMaterial, capMaterial);

  const posts = new InstancedMesh(postGeometry, postMaterial, signContent.length * 2);
  const boards = new InstancedMesh(boardGeometry, boardMaterial, signContent.length);
  const caps = new InstancedMesh(capGeometry, capMaterial, signContent.length);

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

    const spread = SIGN_BOARD_W_M / 2 - 0.35;
    for (let p = 0; p < 2; p++) {
      const d = p === 0 ? -spread : spread;
      pos.set(x + Math.cos(yaw) * d, ground, z - Math.sin(yaw) * d);
      m.compose(pos, q, unit);
      posts.setMatrixAt(i * 2 + p, m);
    }
    pos.set(x, ground + BOARD_CENTER_Y_M, z);
    m.compose(pos, q, unit);
    boards.setMatrixAt(i, m);
    pos.set(x, ground + BOARD_CENTER_Y_M + SIGN_BOARD_H_M / 2 + 0.07, z);
    m.compose(pos, q, unit);
    caps.setMatrixAt(i, m);

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

  posts.instanceMatrix.needsUpdate = true;
  boards.instanceMatrix.needsUpdate = true;
  caps.instanceMatrix.needsUpdate = true;
  group.add(posts, boards, caps);
  return { group, resources, placements };
}
