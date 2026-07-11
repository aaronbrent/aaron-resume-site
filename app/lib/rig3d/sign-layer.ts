import { Matrix4, Quaternion, Vector3, type PerspectiveCamera } from "three";
import { SIGN_BOARD_W_M, type SignPlacement } from "./signs";

/**
 * The sign layer (PLAN-3D ADR-8): real DOM text projected onto the 3D sign
 * boards by a hand-rolled CSS-matrix sync — the CSS3DRenderer technique,
 * owned rather than imported (~100 lines). React renders the panels once;
 * this module owns their transforms.
 *
 * The trick that keeps it cheap: each panel's world matrix is static, so its
 * element transform is written once. Per frame only two things change — the
 * layer's perspective (from the camera's eased FOV) and the camera element's
 * inverse-view transform — plus cheap dataset flips for visibility and the
 * dwell-zone read state ("expandable trail signs": the card grows open while
 * the ride holds inside the zone).
 */

/** DOM panel width in CSS px — sets the meters-per-pixel projection scale. */
export const SIGN_PANEL_W_PX = 340;

/** Half-width of a sign's read zone in ride time. */
const READ_ZONE_T = 0.016;
/** Panels farther than this from the camera don't render at all. */
const VISIBLE_M = 170;

export interface SignLayerOptions {
  /** Fixed full-viewport element; receives `perspective`. */
  layer: HTMLElement;
  /** Its only child; receives the camera transform. */
  cameraEl: HTMLElement;
  /** Panel elements by sign id (each positioned at the layer center). */
  panels: ReadonlyMap<string, HTMLElement>;
  /** Screen-space read cards for narrow viewports, by sign id. */
  sheets?: ReadonlyMap<string, HTMLElement>;
  placements: readonly SignPlacement[];
  camera: PerspectiveCamera;
}

export interface SignLayer {
  /** Sync to the camera pose at ride time t. Call once per rendered frame. */
  update(t: number): void;
  dispose(): void;
}

const cameraCss = (e: Float32Array | number[]) =>
  `translateZ(var(--sign-persp)) matrix3d(${e[0]},${-e[1]!},${e[2]},${e[3]},${e[4]},${-e[5]!},${e[6]},${e[7]},${e[8]},${-e[9]!},${e[10]},${e[11]},${e[12]},${-e[13]!},${e[14]},${e[15]})`;

const objectCss = (e: Float32Array | number[]) =>
  `translate(-50%,-50%) matrix3d(${e[0]},${e[1]},${e[2]},${e[3]},${-e[4]!},${-e[5]!},${-e[6]!},${-e[7]!},${e[8]},${e[9]},${e[10]},${e[11]},${e[12]},${e[13]},${e[14]},${e[15]})`;

export function createSignLayer({
  layer,
  cameraEl,
  panels,
  sheets,
  placements,
  camera,
}: SignLayerOptions): SignLayer {
  const inverse = new Matrix4();
  const world = new Matrix4();
  const pos = new Vector3();
  const quat = new Quaternion();
  const scale = new Vector3();
  const up = new Vector3(0, 1, 0);
  const metersPerPx = SIGN_BOARD_W_M / SIGN_PANEL_W_PX;

  interface Entry {
    el: HTMLElement;
    sheet: HTMLElement | undefined;
    t: number;
    x: number;
    y: number;
    z: number;
    near: boolean;
    read: boolean;
  }
  const entries: Entry[] = [];
  for (const p of placements) {
    const el = panels.get(p.id);
    if (!el) continue;
    // Static world transform: written once, priced never again.
    quat.setFromAxisAngle(up, p.yaw);
    pos.set(p.center[0], p.center[1], p.center[2]);
    scale.setScalar(metersPerPx);
    world.compose(pos, quat, scale);
    el.style.transform = objectCss(world.elements);
    el.dataset.near = "false";
    el.dataset.read = "false";
    entries.push({
      el,
      sheet: sheets?.get(p.id),
      t: p.t,
      x: p.center[0],
      y: p.center[1],
      z: p.center[2],
      near: false,
      read: false,
    });
  }

  let lastPerspPx = 0;

  return {
    update(t: number) {
      const h = layer.clientHeight || window.innerHeight;
      const perspPx = (0.5 * h) / Math.tan((camera.fov * Math.PI) / 360);
      if (Math.abs(perspPx - lastPerspPx) > 0.5) {
        lastPerspPx = perspPx;
        layer.style.perspective = `${perspPx.toFixed(2)}px`;
        layer.style.setProperty("--sign-persp", `${perspPx.toFixed(2)}px`);
      }
      camera.updateMatrixWorld();
      inverse.copy(camera.matrixWorld).invert();
      cameraEl.style.transform = cameraCss(inverse.elements);
      for (const entry of entries) {
        const dx = entry.x - camera.position.x;
        const dy = entry.y - camera.position.y;
        const dz = entry.z - camera.position.z;
        const near = dx * dx + dy * dy + dz * dz < VISIBLE_M * VISIBLE_M;
        if (near !== entry.near) {
          entry.near = near;
          entry.el.dataset.near = String(near);
        }
        const read = Math.abs(t - entry.t) < READ_ZONE_T;
        if (read !== entry.read) {
          entry.read = read;
          entry.el.dataset.read = String(read);
          if (entry.sheet) entry.sheet.dataset.active = String(read);
          const w = layer.clientWidth || window.innerWidth;
          if (read && w >= 640) {
            // Magnetic read (ADR-8): grow the card to a readable on-screen
            // size for the distance where the dwell begins — the pose stays
            // world-anchored and tilted; only its scale reaches for the eye.
            // (Narrow viewports present the screen-space sheet instead.)
            const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
            const targetPx = Math.min(440, Math.max(300, w * 0.36));
            const projectedPx = (SIGN_BOARD_W_M * perspPx) / Math.max(d, 1);
            const grow = Math.min(4.5, Math.max(1.15, targetPx / projectedPx));
            entry.el.style.setProperty("--sign-scale", grow.toFixed(3));
          } else {
            entry.el.style.setProperty("--sign-scale", "1");
          }
        }
      }
    },
    dispose() {
      layer.style.removeProperty("perspective");
      layer.style.removeProperty("--sign-persp");
      cameraEl.style.removeProperty("transform");
      for (const entry of entries) {
        entry.el.style.removeProperty("transform");
        entry.el.style.removeProperty("--sign-scale");
        delete entry.el.dataset.near;
        delete entry.el.dataset.read;
        if (entry.sheet) delete entry.sheet.dataset.active;
      }
    },
  };
}
