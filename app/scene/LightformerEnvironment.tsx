import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { HalfFloatType, Scene, WebGLCubeRenderTarget, type CubeCamera } from "three";
import { createPortal, useThree } from "@react-three/fiber";

/**
 * Bakes `children` (drei <Lightformer>s) into a cube map once and installs it
 * as `scene.environment`. This is exactly the children path of drei's
 * <Environment> (its EnvironmentPortal, frames = 1) — but drei's module also
 * statically pulls RGBE/EXR/HDR-JPG loaders, gainmap-js and fflate for its
 * `files`/`preset` paths: ~17 kB gz of the 3D budget for code that would only
 * ever fetch from a CDN, which this project forbids anyway.
 */
export function LightformerEnvironment({
  children,
  resolution = 64,
  intensity = 1,
}: {
  children: ReactNode;
  resolution?: number;
  intensity?: number;
}) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useRef<CubeCamera>(null);
  const [virtualScene] = useState(() => new Scene());
  const target = useMemo(() => {
    const rt = new WebGLCubeRenderTarget(resolution);
    rt.texture.type = HalfFloatType;
    return rt;
  }, [resolution]);

  // Children's layout effects (Lightformer colours) run before this one.
  useLayoutEffect(() => {
    const cube = camera.current;
    if (!cube) return;
    const autoClear = gl.autoClear;
    gl.autoClear = true;
    cube.update(gl, virtualScene);
    gl.autoClear = autoClear;

    const previous = { map: scene.environment, intensity: scene.environmentIntensity };
    scene.environment = target.texture;
    scene.environmentIntensity = intensity;
    return () => {
      scene.environment = previous.map;
      scene.environmentIntensity = previous.intensity;
    };
  }, [children, gl, scene, target, virtualScene, intensity]);

  useLayoutEffect(() => () => target.dispose(), [target]);

  return createPortal(
    <>
      {children}
      <cubeCamera ref={camera} args={[0.1, 100, target]} />
    </>,
    virtualScene,
  );
}
