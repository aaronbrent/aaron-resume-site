import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  Fog,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
} from "three";
import { closedTrail } from "~/content/closed-trail";
import { line3d } from "~/content/line3d";
import { waypoints } from "~/content/waypoints";
import { contentAnchors } from "~/lib/line/anchors";
import {
  buildLineLut,
  emptyLineLutSample,
  sampleLineLut,
  type LineLutSample,
} from "~/lib/line/lut3d";
import { createScrollLoop, scrollToT } from "~/lib/rig/core";
import { createTerrainBuilder } from "~/lib/world/terrain";

/**
 * The 3D camera rig (PLAN-3D §4–§5): the same scroll-driven loop as the 2D
 * rider, rendering a first-person camera riding the line. React mounts the
 * canvas once; everything after is imperative. Phase A scope: camera on the
 * line over the gray-box corridor-carved mountain — bank/FOV/spray are
 * Phase D channels.
 *
 * Frame-cost discipline: lighting is baked into vertex colors on the CPU
 * (sliceable init work), so the GPU program is MeshBasicMaterial — trivial to
 * compile and rasterize even on software GL, which is what CI's Lighthouse
 * and the weakest real devices run. The terrain ships as z-band chunks so
 * frustum culling keeps the fog-hidden mountain off the rasterizer.
 */

const EYE_HEIGHT_M = 1.7;
const LOOK_AHEAD_T = 0.006;
const LOOK_HEIGHT_M = 1.1;
const BASE_FOV_DEG = 65;
const MAX_DPR = 2;
const FOG_NEAR_M = 60;
const FOG_FAR_M = 320;
const CAMERA_FAR_M = 340;
const TERRAIN_CELL_M = 4;
const TERRAIN_CHUNKS = 8;
const TERRAIN_ROW_SLICE = 96;
const TRI_SLICE = 32768;

export interface Rig3dTelemetry {
  t: number;
  velocity: number;
  frameMs: number;
  dropped: number;
  parked: boolean;
  draws: number;
  dpr: number;
  fovDeg: number;
  initMs: number;
}

export interface Rig3dOptions {
  canvas: HTMLCanvasElement;
  container: HTMLElement;
  onFrame?: (t: Rig3dTelemetry) => void;
  /** First rendered frame — the summit open's fade-in cue (§6). */
  onReady?: () => void;
  /** Unrecoverable renderer failure: demote to Tier 1 at the same t. */
  onFallback: (reason: string) => void;
}

function cssColor(name: string, fallback: string): Color {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name);
  return new Color(value.trim() || fallback);
}

/**
 * Software rasterizers pay per pixel on the CPU: render at 1×, no MSAA.
 * Probed on a throwaway context so the choice lands before renderer creation
 * (antialiasing is a context-creation parameter).
 */
function isSoftwareGl(): boolean {
  try {
    const gl = document.createElement("canvas").getContext("webgl2");
    if (!gl) return false;
    const info = gl.getExtension("WEBGL_debug_renderer_info");
    const name = info
      ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL))
      : String(gl.getParameter(gl.RENDERER));
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return /swiftshader|llvmpipe|softpipe|software/i.test(name);
  } catch {
    return false;
  }
}

export function startRig3d({
  canvas,
  container,
  onFrame,
  onReady,
  onFallback,
}: Rig3dOptions): () => void {
  const initStart = performance.now();
  const softwareGl = isSoftwareGl();
  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({
      canvas,
      antialias: !softwareGl,
      powerPreference: "high-performance",
    });
  } catch {
    onFallback("webgl-init");
    return () => {};
  }
  renderer.setPixelRatio(
    softwareGl ? 1 : Math.min(window.devicePixelRatio || 1, MAX_DPR),
  );
  renderer.setSize(window.innerWidth, window.innerHeight, false);

  const paper = cssColor("--color-paper", "#f4efe3");

  // Software GL also gets the fog pulled in: paper swallows the far chunks
  // before the CPU has to rasterize them (the §7 cut ladder, applied early).
  const fogFar = softwareGl ? FOG_FAR_M * 0.55 : FOG_FAR_M;
  const scene = new Scene();
  scene.background = paper;
  scene.fog = new Fog(paper, softwareGl ? FOG_NEAR_M * 0.55 : FOG_NEAR_M, fogFar);

  const terrainMaterial = new MeshBasicMaterial({ vertexColors: true });
  const postGeometry = new BoxGeometry(0.5, 5, 0.3);
  const postMaterial = new MeshBasicMaterial({ color: 0x6b747c });
  const chunkGeometries: BufferGeometry[] = [];

  const camera = new PerspectiveCamera(
    BASE_FOV_DEG,
    window.innerWidth / window.innerHeight,
    0.3,
    fogFar + (CAMERA_FAR_M - FOG_FAR_M),
  );

  let containerH = container.offsetHeight;
  let ready = false;
  let disposed = false;
  let lut: ReturnType<typeof buildLineLut>;
  const eye: LineLutSample = emptyLineLutSample();
  const ahead: LineLutSample = emptyLineLutSample();
  const telemetry: Rig3dTelemetry = {
    t: 0,
    velocity: 0,
    frameMs: 0,
    dropped: 0,
    parked: true,
    draws: 0,
    dpr: renderer.getPixelRatio(),
    fovDeg: BASE_FOV_DEG,
    initMs: 0,
  };

  function apply(scrollPos: number, velocity: number, frameMs: number): boolean {
    const t = scrollToT(scrollPos, containerH);
    sampleLineLut(lut, t, eye);
    sampleLineLut(lut, t + LOOK_AHEAD_T, ahead);
    camera.position.set(eye.pos[0], eye.pos[1] + EYE_HEIGHT_M, eye.pos[2]);
    camera.lookAt(ahead.pos[0], ahead.pos[1] + LOOK_HEIGHT_M, ahead.pos[2]);
    renderer.render(scene, camera);
    canvas.dataset.t = t.toFixed(4);
    if (!ready) {
      ready = true;
      canvas.dataset.ready = "true";
      document.documentElement.dataset.rideReady = "true";
      onReady?.();
    }
    if (onFrame) {
      telemetry.t = t;
      telemetry.velocity = velocity;
      telemetry.frameMs = frameMs;
      telemetry.dropped = loop.dropped;
      telemetry.parked = loop.parked;
      telemetry.draws = renderer.info.render.calls;
      telemetry.dpr = renderer.getPixelRatio();
      telemetry.fovDeg = camera.fov;
      onFrame(telemetry);
    }
    return false;
  }

  const loop = createScrollLoop({
    getTarget: () => window.scrollY,
    apply,
  });

  function snap() {
    containerH = container.offsetHeight;
    loop.snap();
  }

  function onResize() {
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    snap();
  }

  const onScroll = () => loop.wake();
  const onPageShow = () => snap(); // bfcache restore re-sync
  const onContextLost = (event: Event) => {
    event.preventDefault();
    onFallback("context-lost");
  };
  const ro = new ResizeObserver(() => snap());

  // Init is sliced across frames (§6): the budget is load-bearing for the
  // summit open, and one long post-hydration task is exactly what the
  // performance gate punishes. The 2D map carries the run until the first
  // frame renders, so nothing here races the visitor's scroll.
  const yieldFrame = () =>
    new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

  async function init() {
    await yieldFrame();
    if (disposed) return;
    lut = buildLineLut(line3d.points, contentAnchors());

    await yieldFrame();
    if (disposed) return;
    const builder = createTerrainBuilder(lut, line3d.seed, { cellM: TERRAIN_CELL_M });
    for (let r = 0; r <= builder.rows; r += TERRAIN_ROW_SLICE) {
      builder.fillRows(r, Math.min(r + TERRAIN_ROW_SLICE, builder.rows + 1));
      await yieldFrame();
      if (disposed) return;
    }

    // Flat-shaded facets with the basic material: expand to non-indexed
    // triangles, bake one lambert shade per face into vertex colors, and
    // split into z-band chunks so frustum culling skips what fog hides.
    const triCount = builder.indices.length / 3;
    const base = new Color(0xdcdcd4); // gray-box snow; the palette is Phase B
    const sunLen = Math.hypot(-0.45, 0.8, -0.35);
    const sx = -0.45 / sunLen;
    const sy = 0.8 / sunLen;
    const sz = -0.35 / sunLen;
    const chunkTris = Math.ceil(triCount / TERRAIN_CHUNKS);
    for (let chunkStart = 0; chunkStart < triCount; chunkStart += chunkTris) {
      const chunkEnd = Math.min(chunkStart + chunkTris, triCount);
      const flatPos = new Float32Array((chunkEnd - chunkStart) * 9);
      const flatCol = new Float32Array((chunkEnd - chunkStart) * 9);
      for (let start = chunkStart; start < chunkEnd; start += TRI_SLICE) {
        const end = Math.min(start + TRI_SLICE, chunkEnd);
        for (let tri = start; tri < end; tri++) {
          const ia = builder.indices[tri * 3]! * 3;
          const ib = builder.indices[tri * 3 + 1]! * 3;
          const ic = builder.indices[tri * 3 + 2]! * 3;
          const p = builder.positions;
          const ux = p[ib]! - p[ia]!;
          const uy = p[ib + 1]! - p[ia + 1]!;
          const uz = p[ib + 2]! - p[ia + 2]!;
          const vx = p[ic]! - p[ia]!;
          const vy = p[ic + 1]! - p[ia + 1]!;
          const vz = p[ic + 2]! - p[ia + 2]!;
          let nx = uy * vz - uz * vy;
          let ny = uz * vx - ux * vz;
          let nz = ux * vy - uy * vx;
          const nLen = Math.hypot(nx, ny, nz) || 1;
          nx /= nLen;
          ny /= nLen;
          nz /= nLen;
          const shade = 0.62 + 0.38 * Math.max(0, nx * sx + ny * sy + nz * sz);
          const o = (tri - chunkStart) * 9;
          for (let v = 0; v < 3; v++) {
            const src = v === 0 ? ia : v === 1 ? ib : ic;
            flatPos[o + v * 3] = p[src]!;
            flatPos[o + v * 3 + 1] = p[src + 1]!;
            flatPos[o + v * 3 + 2] = p[src + 2]!;
            flatCol[o + v * 3] = base.r * shade;
            flatCol[o + v * 3 + 1] = base.g * shade;
            flatCol[o + v * 3 + 2] = base.b * shade;
          }
        }
        await yieldFrame();
        if (disposed) return;
      }
      const geometry = new BufferGeometry();
      geometry.setAttribute("position", new BufferAttribute(flatPos, 3));
      geometry.setAttribute("color", new BufferAttribute(flatCol, 3));
      geometry.computeBoundingSphere();
      chunkGeometries.push(geometry);
      scene.add(new Mesh(geometry, terrainMaterial));
    }

    // Gray-box waypoint posts beside the line: enough presence to verify deep
    // links land the camera at the right stretch. Real signage is Phase C.
    const anchored = [...waypoints.map((w) => w.id), closedTrail.id];
    const posts = new InstancedMesh(postGeometry, postMaterial, anchored.length);
    const m = new Matrix4();
    const sample = emptyLineLutSample();
    const anchorT = new Map(contentAnchors().map((a) => [a.id, a.t]));
    anchored.forEach((id, i) => {
      const s = sampleLineLut(lut, anchorT.get(id)!, sample);
      // Stand the post on the corridor's edge, to the rider's right.
      const side = 6;
      const rx = s.tan[2];
      const rz = -s.tan[0];
      m.makeTranslation(s.pos[0] + rx * side, s.pos[1] + 2.5, s.pos[2] + rz * side);
      posts.setMatrixAt(i, m);
    });
    posts.instanceMatrix.needsUpdate = true;
    scene.add(posts);

    // Shader compilation off the render path where the driver allows it,
    // then a frame boundary so the first real render is its own task.
    await renderer.compileAsync(scene, camera).catch(() => {});
    if (disposed) return;
    await yieldFrame();
    if (disposed) return;

    ro.observe(container);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    window.addEventListener("pageshow", onPageShow);

    telemetry.initMs = Math.round(performance.now() - initStart);
    loop.start();
    snap(); // first frame lands placed at the current scroll, not smoothed
    loop.wake();
  }

  canvas.addEventListener("webglcontextlost", onContextLost);
  init().catch(() => {
    if (!disposed) onFallback("init-failed");
  });

  return () => {
    disposed = true;
    loop.stop();
    ro.disconnect();
    window.removeEventListener("scroll", onScroll);
    window.removeEventListener("resize", onResize);
    window.removeEventListener("pageshow", onPageShow);
    canvas.removeEventListener("webglcontextlost", onContextLost);
    delete canvas.dataset.ready;
    delete canvas.dataset.t;
    delete document.documentElement.dataset.rideReady;
    for (const geometry of chunkGeometries) geometry.dispose();
    terrainMaterial.dispose();
    postGeometry.dispose();
    postMaterial.dispose();
    renderer.dispose();
  };
}
