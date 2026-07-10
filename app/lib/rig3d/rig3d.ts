import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  DirectionalLight,
  Fog,
  HemisphereLight,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
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
import { buildTerrain } from "~/lib/world/terrain";

/**
 * The 3D camera rig (PLAN-3D §4–§5): the same scroll-driven loop as the 2D
 * rider, rendering a first-person camera riding the line. React mounts the
 * canvas once; everything after is imperative. Phase A scope: camera on the
 * line over the gray-box corridor-carved mountain — bank/FOV/spray are
 * Phase D channels.
 */

const EYE_HEIGHT_M = 1.7;
const LOOK_AHEAD_T = 0.006;
const LOOK_HEIGHT_M = 1.1;
const BASE_FOV_DEG = 65;
const MAX_DPR = 2;

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

export function startRig3d({
  canvas,
  container,
  onFrame,
  onReady,
  onFallback,
}: Rig3dOptions): () => void {
  const initStart = performance.now();
  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: "high-performance",
    });
  } catch {
    onFallback("webgl-init");
    return () => {};
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_DPR));
  renderer.setSize(window.innerWidth, window.innerHeight, false);

  const paper = cssColor("--color-paper", "#f4efe3");
  const ink = cssColor("--color-ink", "#22303a");

  const scene = new Scene();
  scene.background = paper;
  scene.fog = new Fog(paper, 60, 320);
  scene.add(new HemisphereLight(0xffffff, ink, 0.9));
  const sun = new DirectionalLight(0xffffff, 0.9);
  sun.position.set(-0.5, 1, -0.35);
  scene.add(sun);

  // World build (init budget is load-bearing for the summit open, §6/§3).
  const lut = buildLineLut(line3d.points, contentAnchors());
  const terrainData = buildTerrain(lut, line3d.seed);
  const terrainGeometry = new BufferGeometry();
  terrainGeometry.setAttribute("position", new BufferAttribute(terrainData.positions, 3));
  terrainGeometry.setIndex(new BufferAttribute(terrainData.indices, 1));
  terrainGeometry.computeVertexNormals();
  const terrainMaterial = new MeshStandardMaterial({
    color: 0xdcdcd4, // gray-box snow; the palette shader is Phase B
    flatShading: true,
    roughness: 1,
    metalness: 0,
  });
  const terrain = new Mesh(terrainGeometry, terrainMaterial);
  scene.add(terrain);

  // Gray-box waypoint posts beside the line: enough presence to verify deep
  // links land the camera at the right stretch. Real signage is Phase C.
  const anchored = [...waypoints.map((w) => w.id), closedTrail.id];
  const postGeometry = new BoxGeometry(0.5, 5, 0.3);
  const postMaterial = new MeshStandardMaterial({ color: 0x8a939b, flatShading: true });
  const posts = new InstancedMesh(postGeometry, postMaterial, anchored.length);
  {
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
  }
  scene.add(posts);

  const camera = new PerspectiveCamera(
    BASE_FOV_DEG,
    window.innerWidth / window.innerHeight,
    0.3,
    500,
  );

  let containerH = container.offsetHeight;
  let ready = false;
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
  ro.observe(container);
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onResize);
  window.addEventListener("pageshow", onPageShow);
  canvas.addEventListener("webglcontextlost", onContextLost);

  telemetry.initMs = Math.round(performance.now() - initStart);
  loop.start();
  snap(); // synchronous first frame: deep links land placed, not smoothed
  loop.wake();

  return () => {
    loop.stop();
    ro.disconnect();
    window.removeEventListener("scroll", onScroll);
    window.removeEventListener("resize", onResize);
    window.removeEventListener("pageshow", onPageShow);
    canvas.removeEventListener("webglcontextlost", onContextLost);
    delete canvas.dataset.ready;
    delete canvas.dataset.t;
    delete document.documentElement.dataset.rideReady;
    terrainGeometry.dispose();
    terrainMaterial.dispose();
    postGeometry.dispose();
    postMaterial.dispose();
    renderer.dispose();
  };
}
