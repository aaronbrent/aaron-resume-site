import { useRef } from "react";
import { Vector3, type DirectionalLight } from "three";
import { useFrame } from "@react-three/fiber";
import { Lightformer } from "@react-three/drei/core/Lightformer";
import { LightformerEnvironment } from "./LightformerEnvironment";

/**
 * Key: the sun, a physical point light (decay 2). Intensity is tuned so the
 * mid orbits (r ≈ 13–25) sit near a "noon" exposure; the inner molten planet
 * runs hot (it's lava anyway) and the outer giant gets ~1/3 — the fills below
 * keep its night side from going black.
 */
const SUN_INTENSITY = 1100;
const SUN_COLOR = "#ffd8a8";

/** Cool fill that always comes from just above the camera. */
const FILL_COLOR = "#8fb2ff";
const FILL_INTENSITY = 0.45;

const forward = new Vector3();

/**
 * A directional fill riding with the camera, so whatever the camera looks at
 * (W3's rig moves it) gets a soft, cool frontal bounce — the Pixar trick that
 * keeps terminators readable without flattening the sun's key.
 */
function CameraFill() {
  const light = useRef<DirectionalLight>(null);
  useFrame(({ camera }) => {
    const l = light.current;
    if (!l) return;
    camera.getWorldDirection(forward);
    l.position.copy(camera.position).addScaledVector(camera.up, 4);
    l.target.position.copy(camera.position).addScaledVector(forward, 10);
    l.target.updateMatrixWorld();
  });
  return <directionalLight ref={light} color={FILL_COLOR} intensity={FILL_INTENSITY} />;
}

/**
 * Low-intensity image-based fill rendered once from inline Lightformers
 * (nebula-coloured soft boxes, each facing the origin) — never a downloaded
 * HDR: drei's `preset`/`files` fetch from a CDN and are banned here.
 * Gives planets a gentle ambient tint and a soft specular sheen.
 */
function AmbientEnvironment() {
  return (
    <LightformerEnvironment resolution={64} intensity={0.35}>
      <color attach="background" args={["#120e2a"]} />
      <Lightformer
        form="rect"
        intensity={2.2}
        color="#7f6bff"
        position={[0, 6, 0]}
        scale={[12, 12, 1]}
      />
      <Lightformer
        form="rect"
        intensity={1.4}
        color="#2fb5c4"
        position={[0, -6, 0]}
        scale={[12, 12, 1]}
      />
      <Lightformer
        form="ring"
        intensity={1.6}
        color="#c46aa8"
        position={[-6, 1, 4]}
        scale={5}
      />
      <Lightformer
        form="rect"
        intensity={1.2}
        color="#ffb27a"
        position={[6, 0, -3]}
        scale={[4, 6, 1]}
      />
    </LightformerEnvironment>
  );
}

export function Lighting() {
  return (
    <>
      <pointLight
        position={[0, 0, 0]}
        color={SUN_COLOR}
        intensity={SUN_INTENSITY}
        decay={2}
      />
      <CameraFill />
      <AmbientEnvironment />
    </>
  );
}
