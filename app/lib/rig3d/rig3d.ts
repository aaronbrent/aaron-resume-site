import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Fog,
  Group,
  InstancedMesh,
  Line,
  LineBasicMaterial,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  Quaternion,
  Scene,
  Vector3,
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
import { createScrollLoop, scrollToT, type ScrollLoop } from "~/lib/rig/core";
import { createNoise2D, fbm } from "~/lib/world/noise";
import { scatterTrees } from "~/lib/world/scatter";
import { deriveForkBranches } from "~/lib/world/junctions";
import { createTerrainBuilder } from "~/lib/world/terrain";
import { planTown } from "~/lib/world/town";
import { deriveDynamics, emptyDynamics } from "./dynamics";
import { ANIME, SUN_DIR } from "./palette";
import { createMassif, createRidges } from "./ridges";
import { createSky } from "./sky";
import { createTown } from "./town";
import { createContourMaterial } from "./terrain-material";

/**
 * The 3D camera rig (PLAN-3D §4–§5): the same scroll-driven loop as the 2D
 * rider, rendering a first-person camera riding the line. React mounts the
 * canvas once; everything after is imperative. Phase B scope: the map stands
 * up — palette vertex colors, the contour-line shader, trees, ridgelines,
 * the lift line. Bank/FOV/spray are Phase D channels.
 *
 * Frame-cost discipline: startRig3d returns immediately and ALL heavy work —
 * including context creation, which costs hundreds of throttled milliseconds
 * on software GL — happens in an init sliced across animation frames. The 2D
 * map carries the run until the first frame renders (§6). Lighting and
 * palette bake into vertex colors on the CPU, so the GPU programs stay
 * trivial. Software GL is screened before this lazy chunk imports; hardware
 * gets the contour shader. `?gl=full` forces the probe through for e2e and
 * tuning.
 */

const EYE_HEIGHT_M = 1.7;
const LOOK_HEIGHT_M = 1.1;
const BASE_FOV_DEG = 65;
const MAX_DPR = 2;
// Haze, not paper: fog reads as air now, thin enough that the valley below —
// the town, the forests across the run — stays legible at distance (ADR-9
// amended). The far plane reaches the sky dome and the hero massif.
const FOG_NEAR_M = 80;
const FOG_FAR_M = 780;
const CAMERA_FAR_M = 4200;
const TERRAIN_CELL_M = 4;
const TERRAIN_CHUNKS = 8;
const TERRAIN_ROW_SLICE = 96;
const TRI_SLICE = 12288;
const TREE_SLICE = 600;
const LIFT_TOWERS = 7;

export interface Rig3dTelemetry {
  t: number;
  velocity: number;
  frameMs: number;
  dropped: number;
  parked: boolean;
  draws: number;
  dpr: number;
  fovDeg: number;
  bankDeg: number;
  initMs: number;
}

export interface Rig3dOptions {
  canvas: HTMLCanvasElement;
  container: HTMLElement;
  /** POV overlay (board nose + mitten): driven per frame via CSS variables. */
  pov?: HTMLElement | null;
  onFrame?: (t: Rig3dTelemetry) => void;
  /** First rendered frame — the summit open's fade-in cue (§6). */
  onReady?: () => void;
  /** Unrecoverable renderer failure: demote to Tier 1 at the same t. */
  onFallback: (reason: string) => void;
}

const smooth01 = (edge0: number, edge1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

export function startRig3d({
  canvas,
  container,
  pov,
  onFrame,
  onReady,
  onFallback,
}: Rig3dOptions): () => void {
  const initStart = performance.now();
  let disposed = false;
  let ready = false;
  let containerH = container.offsetHeight;
  let renderer: WebGLRenderer | undefined;
  let camera!: PerspectiveCamera;
  /** Sky + far ranges: follows the camera's position, never its rotation. */
  let backdrop: Group | undefined;
  let lut!: ReturnType<typeof buildLineLut>;
  let loop!: ScrollLoop;
  const scene = new Scene();
  const disposables: Array<{ dispose(): void }> = [];
  const track = <T extends { dispose(): void }>(resource: T): T => {
    disposables.push(resource);
    return resource;
  };
  const eye: LineLutSample = emptyLineLutSample();
  const ahead: LineLutSample = emptyLineLutSample();
  // Dynamics targets derive fresh each frame; the pose channels ease toward
  // them (lens slower than body), and the loop stays awake until they settle.
  const targets = emptyDynamics();
  const pose = emptyDynamics();
  const telemetry: Rig3dTelemetry = {
    t: 0,
    velocity: 0,
    frameMs: 0,
    dropped: 0,
    parked: true,
    draws: 0,
    dpr: 1,
    fovDeg: BASE_FOV_DEG,
    bankDeg: 0,
    initMs: 0,
  };

  function apply(scrollPos: number, velocity: number, frameMs: number): boolean {
    const t = scrollToT(scrollPos, containerH);
    sampleLineLut(lut, t, eye);
    deriveDynamics(eye, targets);

    // Ease pose toward the targets — the body settles quicker than the lens.
    // frameMs 0 is a snap (resize, deep link, first frame): land instantly.
    const bodyEase = frameMs <= 0 ? 1 : 1 - Math.exp(-frameMs / 170);
    const lensEase = frameMs <= 0 ? 1 : 1 - Math.exp(-frameMs / 340);
    pose.bankDeg += (targets.bankDeg - pose.bankDeg) * bodyEase;
    pose.boardYawDeg += (targets.boardYawDeg - pose.boardYawDeg) * bodyEase;
    pose.eyeHeightM += (targets.eyeHeightM - pose.eyeHeightM) * bodyEase;
    pose.lookAheadT += (targets.lookAheadT - pose.lookAheadT) * lensEase;
    pose.fovDeg += (targets.fovDeg - pose.fovDeg) * lensEase;

    sampleLineLut(lut, t + pose.lookAheadT, ahead);
    // Past the line's end the ahead sample collapses onto the eye; carry the
    // gaze along the final tangent instead — over the brink, at the town.
    if (t + pose.lookAheadT >= 1) {
      ahead.pos[0] = eye.pos[0] + eye.tan[0] * 12;
      ahead.pos[1] = eye.pos[1] + eye.tan[1] * 12;
      ahead.pos[2] = eye.pos[2] + eye.tan[2] * 12;
    }
    camera.position.set(eye.pos[0], eye.pos[1] + pose.eyeHeightM, eye.pos[2]);
    camera.lookAt(ahead.pos[0], ahead.pos[1] + LOOK_HEIGHT_M, ahead.pos[2]);
    camera.rotateZ((-pose.bankDeg * Math.PI) / 180);
    if (Math.abs(camera.fov - pose.fovDeg) > 0.01) {
      camera.fov = pose.fovDeg;
      camera.updateProjectionMatrix();
    }
    backdrop?.position.copy(camera.position); // infinitely-far scenery
    if (pov) {
      const crouch = (EYE_HEIGHT_M - pose.eyeHeightM) / EYE_HEIGHT_M;
      pov.style.setProperty("--pov-bank", `${(pose.bankDeg * 0.55).toFixed(2)}deg`);
      pov.style.setProperty("--pov-yaw", `${pose.boardYawDeg.toFixed(2)}deg`);
      pov.style.setProperty("--pov-crouch", crouch.toFixed(3));
      // The rider steps out of frame as the run parks over the town.
      pov.style.setProperty("--pov-exit", (1 - smooth01(0.965, 0.99, t)).toFixed(3));
    }
    renderer!.render(scene, camera);
    canvas.dataset.t = t.toFixed(4);
    if (!ready) {
      ready = true;
      canvas.dataset.ready = "true";
      if (pov) pov.dataset.ready = "true";
      document.documentElement.dataset.rideReady = "true";
      onReady?.();
    }
    if (onFrame) {
      telemetry.t = t;
      telemetry.velocity = velocity;
      telemetry.frameMs = frameMs;
      telemetry.dropped = loop.dropped;
      telemetry.parked = loop.parked;
      telemetry.draws = renderer!.info.render.calls;
      telemetry.dpr = renderer!.getPixelRatio();
      telemetry.fovDeg = camera.fov;
      telemetry.bankDeg = pose.bankDeg;
      onFrame(telemetry);
    }
    // Stay awake while the pose is still easing toward its targets.
    return (
      Math.abs(targets.bankDeg - pose.bankDeg) > 0.05 ||
      Math.abs(targets.fovDeg - pose.fovDeg) > 0.05 ||
      Math.abs(targets.eyeHeightM - pose.eyeHeightM) > 0.003
    );
  }

  function snap() {
    containerH = container.offsetHeight;
    loop.snap();
  }

  function onResize() {
    renderer!.setSize(window.innerWidth, window.innerHeight, false);
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

  const yieldFrame = () =>
    new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

  async function init() {
    // Leave the React layout-effect task before doing anything expensive.
    await yieldFrame();
    if (disposed) return;
    await yieldFrame();
    if (disposed) return;
    try {
      renderer = new WebGLRenderer({
        canvas,
        antialias: true,
        powerPreference: "high-performance",
      });
    } catch {
      onFallback("webgl-init");
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_DPR));
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    telemetry.dpr = renderer.getPixelRatio();

    scene.background = ANIME.haze;
    scene.fog = new Fog(ANIME.haze, FOG_NEAR_M, FOG_FAR_M);
    camera = new PerspectiveCamera(
      BASE_FOV_DEG,
      window.innerWidth / window.innerHeight,
      0.3,
      CAMERA_FAR_M,
    );

    // Palette and lighting bake into vertex colors (sliced work below); the
    // contour-line signature shader draws on top.
    const terrainMaterial = track(
      createContourMaterial({
        line: ANIME.contour,
        fogColor: ANIME.haze,
        fogNear: FOG_NEAR_M,
        fogFar: FOG_FAR_M,
      }),
    );

    // The vault and the distance: sky dome + sun + clouds and the painted
    // ranges ride along with the camera; the hero massif stands in the world
    // down-valley, so the descent parallaxes against it (ADR-9 amended).
    await yieldFrame();
    if (disposed) return;
    backdrop = new Group();
    const sky = createSky(line3d.seed);
    const ridges = createRidges(line3d.seed);
    sky.resources.forEach(track);
    ridges.resources.forEach(track);
    backdrop.add(sky.group, ridges.group);
    scene.add(backdrop);
    const massif = createMassif(line3d.seed);
    massif.resources.forEach(track);
    scene.add(massif.group);

    await yieldFrame();
    if (disposed) return;
    lut = buildLineLut(line3d.points, contentAnchors());

    await yieldFrame();
    if (disposed) return;
    // The untaken trails: one decoy fork per career junction, carved into
    // the heightfield and kept clear of trees (§5 amended).
    const branches = deriveForkBranches(
      lut,
      waypoints.map((w) => ({ id: w.id, t: w.t })),
    );
    const builder = createTerrainBuilder(lut, line3d.seed, {
      cellM: TERRAIN_CELL_M,
      branches,
    });
    for (let r = 0; r <= builder.rows; r += TERRAIN_ROW_SLICE) {
      builder.fillRows(r, Math.min(r + TERRAIN_ROW_SLICE, builder.rows + 1));
      await yieldFrame();
      if (disposed) return;
    }

    // Flat-shaded facets: expand to non-indexed triangles, bake the palette
    // (warm-lit snow, saturated blue shadow, sienna rock on the steeps, a
    // hazy noise wash) with one golden-hour shade per face, split into z-band
    // chunks so frustum culling skips what fog hides.
    const tintNoise = createNoise2D(line3d.seed ^ 0x7a9e);
    const snowColor = new Color();
    const rockColor = new Color();
    const faceColor = new Color();
    const triCount = builder.indices.length / 3;
    const sx = SUN_DIR.x;
    const sy = SUN_DIR.y;
    const sz = SUN_DIR.z;
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
          const cx = (p[ia]! + p[ib]! + p[ic]!) / 3;
          const cz = (p[ia + 2]! + p[ib + 2]! + p[ic + 2]!) / 3;
          // Steep faces break through the snow as sienna rock; every face
          // blends its lit and shadow paint by how squarely it takes the low
          // sun — snow that faces away goes properly blue.
          const rockMix = 1 - smooth01(0.58, 0.74, ny);
          const wash = (fbm(tintNoise, cx * 0.02, cz * 0.02, 2) * 0.5 + 0.5) * 0.1;
          const lit = smooth01(-0.08, 0.62, Math.max(0, nx * sx + ny * sy + nz * sz));
          snowColor.copy(ANIME.snowShade).lerp(ANIME.snowLit, lit);
          rockColor.copy(ANIME.rockShade).lerp(ANIME.rockLit, lit);
          faceColor
            .copy(snowColor)
            .lerp(rockColor, rockMix * 0.88)
            .lerp(ANIME.haze, wash);
          const o = (tri - chunkStart) * 9;
          for (let v = 0; v < 3; v++) {
            const src = v === 0 ? ia : v === 1 ? ib : ic;
            flatPos[o + v * 3] = p[src]!;
            flatPos[o + v * 3 + 1] = p[src + 1]!;
            flatPos[o + v * 3 + 2] = p[src + 2]!;
            flatCol[o + v * 3] = faceColor.r;
            flatCol[o + v * 3 + 1] = faceColor.g;
            flatCol[o + v * 3 + 2] = faceColor.b;
          }
        }
        await yieldFrame();
        if (disposed) return;
      }
      const geometry = track(new BufferGeometry());
      geometry.setAttribute("position", new BufferAttribute(flatPos, 3));
      geometry.setAttribute("color", new BufferAttribute(flatCol, 3));
      geometry.computeBoundingSphere();
      scene.add(new Mesh(geometry, terrainMaterial));
      await yieldFrame();
      if (disposed) return;
    }

    // Treeline: three instanced draws (canopy, trunk, snow dust on the
    // crown), deterministic from the content seed.
    const trees = scatterTrees(lut, line3d.seed, { branches });
    await yieldFrame();
    if (disposed) return;
    const canopyGeometry = track(new ConeGeometry(0.42, 0.85, 6));
    canopyGeometry.translate(0, 0.62, 0);
    const trunkGeometry = track(new CylinderGeometry(0.045, 0.07, 0.32, 5));
    trunkGeometry.translate(0, 0.16, 0);
    const dustGeometry = track(new ConeGeometry(0.31, 0.46, 6));
    dustGeometry.translate(0, 0.82, 0);
    const canopyMaterial = track(new MeshBasicMaterial({ color: 0xffffff }));
    const trunkMaterial = track(new MeshBasicMaterial({ color: ANIME.trunk }));
    const dustMaterial = track(new MeshBasicMaterial({ color: ANIME.snowDust }));
    const canopies = new InstancedMesh(canopyGeometry, canopyMaterial, trees.length);
    const trunks = new InstancedMesh(trunkGeometry, trunkMaterial, trees.length);
    const dust = new InstancedMesh(dustGeometry, dustMaterial, trees.length);
    {
      const m = new Matrix4();
      const q = new Quaternion();
      const pos = new Vector3();
      const scale = new Vector3();
      const up = new Vector3(0, 1, 0);
      const tint = new Color();
      for (let start = 0; start < trees.length; start += TREE_SLICE) {
        const end = Math.min(start + TREE_SLICE, trees.length);
        for (let i = start; i < end; i++) {
          const tree = trees[i]!;
          const ground = builder.heightAt(tree.x, tree.z);
          q.setFromAxisAngle(up, tree.tint * Math.PI);
          pos.set(tree.x, ground - 0.15, tree.z);
          scale.setScalar(tree.heightM);
          m.compose(pos, q, scale);
          canopies.setMatrixAt(i, m);
          trunks.setMatrixAt(i, m);
          dust.setMatrixAt(i, m);
          // Cold spruce, bluer in the woods' shadowed patches.
          tint
            .copy(ANIME.spruce)
            .lerp(ANIME.spruceShade, 0.3 + 0.3 * Math.abs(tree.tint))
            .offsetHSL(0, 0, tree.tint * 0.03);
          canopies.setColorAt(i, tint);
        }
        await yieldFrame();
        if (disposed) return;
      }
      canopies.instanceMatrix.needsUpdate = true;
      trunks.instanceMatrix.needsUpdate = true;
      dust.instanceMatrix.needsUpdate = true;
      if (canopies.instanceColor) canopies.instanceColor.needsUpdate = true;
    }
    scene.add(canopies, trunks, dust);

    // The lift line climbs past drop 1 to the summit station — the gondola
    // credits' eventual 3D home (Phase E stretch); towers + cable for now.
    const towerPostGeometry = track(new BoxGeometry(0.7, 11, 0.7));
    const towerArmGeometry = track(new BoxGeometry(5.5, 0.5, 0.5));
    const steel = track(new MeshBasicMaterial({ color: ANIME.steel }));
    const towerPosts = new InstancedMesh(towerPostGeometry, steel, LIFT_TOWERS);
    const towerArms = new InstancedMesh(towerArmGeometry, steel, LIFT_TOWERS);
    const cablePoints = new Float32Array(LIFT_TOWERS * 3);
    {
      const m = new Matrix4();
      for (let i = 0; i < LIFT_TOWERS; i++) {
        const f = i / (LIFT_TOWERS - 1);
        // West of the run, clear of the SoFi junction's bench track.
        const x = -58 + 6 * f;
        const z = -30 + 265 * f;
        const ground = builder.heightAt(x, z);
        m.makeTranslation(x, ground + 5.2, z);
        towerPosts.setMatrixAt(i, m);
        m.makeTranslation(x, ground + 10.4, z);
        towerArms.setMatrixAt(i, m);
        cablePoints[i * 3] = x;
        cablePoints[i * 3 + 1] = ground + 10.7;
        cablePoints[i * 3 + 2] = z;
      }
      towerPosts.instanceMatrix.needsUpdate = true;
      towerArms.instanceMatrix.needsUpdate = true;
    }
    const cableGeometry = track(new BufferGeometry());
    cableGeometry.setAttribute("position", new BufferAttribute(cablePoints, 3));
    const cable = new Line(
      cableGeometry,
      track(new LineBasicMaterial({ color: ANIME.steel })),
    );
    scene.add(towerPosts, towerArms, cable);

    // The ski town, on real basin ground past the runout — the run aims
    // straight at it, and it resolves out of the haze as the ride descends.
    await yieldFrame();
    if (disposed) return;
    {
      const end = sampleLineLut(lut, 1, emptyLineLutSample());
      const plan = planTown(line3d.seed, { x: end.pos[0] + 16, z: end.pos[2] + 330 });
      const town = createTown(plan, builder.heightAt, line3d.seed);
      town.resources.forEach(track);
      scene.add(town.group);
      canvas.dataset.town = String(plan.buildings.length);
    }

    // Gray-box waypoint posts beside the line, on the groomed apron — the
    // deep-link landing markers. Real signage is Phase C.
    const postGeometry = track(new BoxGeometry(0.5, 5, 0.3));
    const postMaterial = track(new MeshBasicMaterial({ color: 0x6b747c }));
    const anchored = [...waypoints.map((w) => w.id), closedTrail.id];
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

    // Shader compilation off the render path where the driver allows it,
    // then a frame boundary so the first real render is its own task.
    await renderer.compileAsync(scene, camera).catch(() => {});
    if (disposed) return;
    await yieldFrame();
    if (disposed) return;

    // Warm-up: an 8×8 render from the real starting view pays the buffer
    // uploads in its own task, so the first visible frame is raster only.
    // The pose starts settled on its targets — no ease-in on first paint.
    {
      const t0 = scrollToT(window.scrollY, containerH);
      sampleLineLut(lut, t0, eye);
      deriveDynamics(eye, targets);
      Object.assign(pose, targets);
      sampleLineLut(lut, t0 + pose.lookAheadT, ahead);
      camera.fov = pose.fovDeg;
      camera.updateProjectionMatrix();
      camera.position.set(eye.pos[0], eye.pos[1] + pose.eyeHeightM, eye.pos[2]);
      camera.lookAt(ahead.pos[0], ahead.pos[1] + LOOK_HEIGHT_M, ahead.pos[2]);
      camera.rotateZ((-pose.bankDeg * Math.PI) / 180);
      backdrop?.position.copy(camera.position);
      renderer.setSize(8, 8, false);
      renderer.render(scene, camera);
      renderer.setSize(window.innerWidth, window.innerHeight, false);
    }
    await yieldFrame();
    if (disposed) return;

    loop = createScrollLoop({
      getTarget: () => window.scrollY,
      apply,
    });
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
    loop?.stop();
    ro.disconnect();
    window.removeEventListener("scroll", onScroll);
    window.removeEventListener("resize", onResize);
    window.removeEventListener("pageshow", onPageShow);
    canvas.removeEventListener("webglcontextlost", onContextLost);
    delete canvas.dataset.ready;
    delete canvas.dataset.t;
    delete document.documentElement.dataset.rideReady;
    if (pov) {
      delete pov.dataset.ready;
      for (const name of ["--pov-bank", "--pov-yaw", "--pov-crouch", "--pov-exit"]) {
        pov.style.removeProperty(name);
      }
    }
    for (const resource of disposables) resource.dispose();
    renderer?.dispose();
  };
}
