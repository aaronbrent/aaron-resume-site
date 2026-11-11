import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ACESFilmicToneMapping, SRGBColorSpace } from "three";
import { useFrame, useThree, type RenderProps } from "@react-three/fiber";
import { planets } from "~/content/planets";
import { subscribe } from "~/lib/progress";
import { isQaMode } from "./constants";
import { DustMotes } from "./DustMotes";
import { CameraRig } from "./CameraRig";
import { PlanetProbe } from "./PlanetProbe";
import { planetPosition } from "./layout";
import { Lighting } from "./Lighting";
import { Nebula } from "./Nebula";
import { PlanetBody } from "./planets";
import { FpsGovernor, forcedTier, initialTier, TIERS, type Tier } from "./quality";
import { SceneCanvas } from "./SceneCanvas";
import { Sun } from "./Sun";

export interface SceneProps {
  /** Called once the first frame has been drawn to the canvas. */
  onFirstFrame: () => void;
  /** Called on WebGL context loss or a scene error; the mount unmounts us. */
  onFail: () => void;
}

// Module-level so re-renders never hand R3F "new" camera/gl options.
const DPRS: Record<Tier, [number, number]> = {
  2: [1, TIERS[2].dprMax],
  1: [1, TIERS[1].dprMax],
  0: [1, TIERS[0].dprMax],
};
/**
 * Plain WebGL rendering straight to the canvas: native MSAA, tone mapping and
 * sRGB output on the renderer, no off-screen post chain. The post-processing
 * composer (bloom) drew only a strip of the frame on real GPUs, invisible to
 * software-GL QA, so it was removed; the sun halo and shader glows stand in.
 */
const GL: RenderProps<HTMLCanvasElement>["gl"] = {
  antialias: true,
  powerPreference: "high-performance",
  stencil: false,
};
/** Initial camera only; CameraRig owns the pose and lens. */
const CAMERA: RenderProps<HTMLCanvasElement>["camera"] = {
  fov: 38,
  near: 0.1,
  far: 2000,
  position: [0, 30, 80],
};
const onCreated: RenderProps<HTMLCanvasElement>["onCreated"] = ({ gl }) => {
  // ACES + sRGB on the renderer. Custom shaders include three's
  // tonemapping/colorspace chunks so they go through the same curve.
  gl.toneMapping = ACESFilmicToneMapping;
  gl.outputColorSpace = SRGBColorSpace;
};

/** Frames rendered on demand after mount in QA mode (shader compile, env bake). */
const QA_WARMUP_FRAMES = 8;

/**
 * `?qa=1` renders on demand (frameloop="demand") with every clock frozen, so
 * the image is a pure function of camera pose + viewport. This keeps a short
 * burst of frames going after mount and re-renders when scroll progress
 * changes (W3's rig reads it in useFrame; W6 snapshots at fixed scrolls).
 */
function QaFrameDriver() {
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    invalidate(QA_WARMUP_FRAMES);
    return subscribe(() => invalidate(QA_WARMUP_FRAMES));
  }, [invalidate]);
  return null;
}

/** Reports the first rendered frame (html[data-scene=on] keys off it). */
function FirstFrame({ onFirstFrame }: { onFirstFrame: () => void }) {
  const reported = useRef(false);
  // Priority 0 runs before R3F's own render of the frame; the rAF lands
  // after that frame has been drawn.
  useFrame(() => {
    if (reported.current) return;
    reported.current = true;
    requestAnimationFrame(onFirstFrame);
  });
  return null;
}

function startingTier(): Tier {
  return (
    forcedTier(window.location.search) ??
    initialTier({
      devicePixelRatio: window.devicePixelRatio || 1,
      width: window.innerWidth,
      height: window.innerHeight,
      coarsePointer: window.matchMedia("(pointer: coarse)").matches,
      cores: navigator.hardwareConcurrency || undefined,
    })
  );
}

/** Steps quality down (never up) when the frame rate can't hold (§6). */
function QualityGovernor({ onDrop }: { onDrop: () => void }) {
  const governor = useRef(new FpsGovernor());
  useEffect(() => {
    const onVisibility = () => governor.current.reset();
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);
  useFrame((_, delta) => {
    if (document.hidden) return;
    if (governor.current.sample(delta)) onDrop();
  });
  return null;
}

/**
 * The star system (docs/PLAN-STAR-SYSTEM.md §4). Lazy-loaded by SceneMount;
 * this module and everything it imports form the 3D chunk.
 */
export default function Scene({ onFirstFrame, onFail }: SceneProps) {
  const qa = useMemo(() => isQaMode(), []);
  const pinned = useMemo(() => forcedTier(window.location.search) !== null, []);
  const [tier, setTier] = useState<Tier>(startingTier);
  const quality = TIERS[tier];
  const dropTier = useCallback(() => setTier((t) => (t > 0 ? ((t - 1) as Tier) : t)), []);
  useEffect(() => {
    document.documentElement.dataset.sceneTier = String(tier);
  }, [tier]);

  return (
    <SceneCanvas
      dpr={DPRS[tier]}
      frameloop={qa ? "demand" : "always"}
      gl={GL}
      camera={CAMERA}
      onCreated={onCreated}
      onError={onFail}
      onContextLost={onFail}
    >
      <color attach="background" args={["#07061a"]} />
      <CameraRig qa={qa} />
      <Nebula />
      <DustMotes qa={qa} count={quality.dust} />
      <Lighting />
      <Sun qa={qa} />
      {planets.map((p) => (
        <PlanetBody
          key={p.id}
          visual={p.visual}
          position={planetPosition(p.visual)}
          qa={qa}
          detail={quality.detail}
        />
      ))}
      {qa ? <PlanetProbe /> : null}
      <FirstFrame onFirstFrame={onFirstFrame} />
      {pinned || tier === 0 ? null : <QualityGovernor onDrop={dropTier} />}
      {qa ? <QaFrameDriver /> : null}
    </SceneCanvas>
  );
}
