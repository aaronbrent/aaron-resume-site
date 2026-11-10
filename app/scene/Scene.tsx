import { useEffect, useMemo } from "react";
import { ACESFilmicToneMapping, SRGBColorSpace } from "three";
import { useThree, type RenderProps } from "@react-three/fiber";
import { planets } from "~/content/planets";
import { subscribe } from "~/lib/progress";
import { DPR_MAX, isQaMode } from "./constants";
import { DustMotes } from "./DustMotes";
import { CameraRig } from "./CameraRig";
import { Effects } from "./Effects";
import { planetPosition } from "./layout";
import { Lighting } from "./Lighting";
import { Nebula } from "./Nebula";
import { OrbitGuides } from "./OrbitGuides";
import { PlanetBody } from "./planets";
import { SceneCanvas } from "./SceneCanvas";
import { Sun } from "./Sun";

export interface SceneProps {
  /** Called once the composer has drawn its first frame to the canvas. */
  onFirstFrame: () => void;
  /** Called on WebGL context loss or a scene error; the mount unmounts us. */
  onFail: () => void;
}

// Module-level so re-renders never hand R3F "new" camera/gl options.
const DPR: [number, number] = [1, DPR_MAX];
/** The composer does the AA (MSAA on its input buffer) and tone mapping. */
const GL: RenderProps<HTMLCanvasElement>["gl"] = {
  antialias: false,
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
  // Nominal renderer settings (ACES, sRGB). While the composer is mounted it
  // switches renderer tone mapping off and applies ACES itself (Effects.tsx).
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

/**
 * The star system (docs/PLAN-STAR-SYSTEM.md §4). Lazy-loaded by SceneMount;
 * this module and everything it imports form the 3D chunk.
 */
export default function Scene({ onFirstFrame, onFail }: SceneProps) {
  const qa = useMemo(() => isQaMode(), []);

  return (
    <SceneCanvas
      dpr={DPR}
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
      <DustMotes qa={qa} />
      <Lighting />
      <Sun qa={qa} />
      <OrbitGuides />
      {planets.map((p) => (
        <PlanetBody
          key={p.id}
          visual={p.visual}
          position={planetPosition(p.visual)}
          qa={qa}
        />
      ))}
      <Effects onFirstFrame={onFirstFrame} />
      {qa ? <QaFrameDriver /> : null}
    </SceneCanvas>
  );
}
