/**
 * Dev-only planet lab (registered in app/routes.ts only when LAB=1).
 *   /lab?planet=<id>   one planet at its true layout position, framed from the
 *                      sun side so lighting matches the real scene
 *   /lab?planet=all    all five in a row (one canvas each, same framing)
 *   &qa=1              frozen, deterministic motion (isQaMode)
 *   &seed=N            the layout seed (system-layout.ts), as on the home page
 * Lighting mirrors W2a's scene: point light at the origin (decay 2), cool
 * camera-side fill, low Lightformer environment, ACES on the renderer, and
 * no post-processing (removed from the scene: it broke on real GPUs).
 */
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment } from "@react-three/drei/core/Environment";
import { Lightformer } from "@react-three/drei/core/Lightformer";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { planets } from "~/content/planets";
import type { Planet } from "~/content/types";
import { isQaMode } from "~/scene/constants";
import { labFraming } from "~/scene/planets/lab-math";
import { getSystemLayout, type PlacedPlanet } from "~/scene/system-layout";
import { PlanetBody } from "~/scene/planets";

export function meta() {
  return [{ title: "Planet lab" }, { name: "robots", content: "noindex" }];
}

/** Irradiance the lab sun delivers at each planet (intensity = E · d²). */
const LAB_SUN_IRRADIANCE = 2.4;
const FOV = 32;

function Rig({ planet, placed }: { planet: Planet; placed: PlacedPlanet }) {
  const camera = useThree((s) => s.camera);
  const aspect = useThree((s) => s.size.width / Math.max(1, s.size.height));
  useLayoutEffect(() => {
    const { planet: target, camera: position } = labFraming(
      planet.visual,
      placed.position,
      FOV,
      aspect,
    );
    camera.position.set(...position);
    camera.lookAt(...target);
    camera.updateProjectionMatrix();
  }, [camera, planet, placed, aspect]);
  return null;
}

function ReadyFlag({ onReady }: { onReady: () => void }) {
  const frames = useRef(0);
  useFrame(() => {
    frames.current += 1;
    if (frames.current === 12) onReady();
  });
  return null;
}

function LabView({
  planet,
  placed,
  qa,
}: {
  planet: Planet;
  placed: PlacedPlanet;
  qa: boolean;
}) {
  const [ready, setReady] = useState(false);
  const { planet: position, fill } = labFraming(planet.visual, placed.position, FOV);
  const d = Math.hypot(...position);
  return (
    <div
      className="relative h-full min-w-0 flex-1"
      data-lab-planet={planet.id}
      data-ready={ready ? "1" : "0"}
    >
      <Canvas
        dpr={1}
        gl={{ antialias: true, preserveDrawingBuffer: true }}
        camera={{ fov: FOV, near: 0.1, far: 200 }}
      >
        <color attach="background" args={["#05060f"]} />
        <Rig planet={planet} placed={placed} />
        <pointLight
          position={[0, 0, 0]}
          decay={2}
          intensity={LAB_SUN_IRRADIANCE * d * d}
          color="#fff1dc"
        />
        <directionalLight position={fill} intensity={0.22} color="#8fa8ff" />
        <mesh>
          <sphereGeometry args={[1, 32, 16]} />
          <meshBasicMaterial color={[4, 2.6, 1.2]} toneMapped={false} />
        </mesh>
        <Environment resolution={32} frames={1} environmentIntensity={0.25}>
          <Lightformer
            intensity={1.2}
            color="#ffd9a8"
            position={[0, 0, 10]}
            scale={[6, 6, 1]}
          />
          <Lightformer
            intensity={0.6}
            color="#5b6dff"
            position={[0, 5, -9]}
            scale={[10, 10, 1]}
          />
          <Lightformer
            intensity={0.4}
            color="#9b5bff"
            position={[-8, -3, 4]}
            scale={[8, 8, 1]}
          />
        </Environment>
        <PlanetBody
          visual={planet.visual}
          position={position}
          moons={placed.moons}
          qa={qa}
        />
        <ReadyFlag onReady={() => setReady(true)} />
      </Canvas>
      <p className="pointer-events-none absolute bottom-2 left-0 w-full text-center font-mono text-xs text-white/50">
        {planet.id} · {planet.visual.biome}
      </p>
    </div>
  );
}

export default function Lab() {
  const [params] = useSearchParams();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const which = params.get("planet") ?? "all";
  const qa = isQaMode(`?${params.toString()}`);
  const shown = which === "all" ? planets : planets.filter((p) => p.id === which);
  const layout = getSystemLayout(`?${params.toString()}`);

  return (
    <div className="fixed inset-0 flex items-center bg-[#05060f]">
      {!mounted ? null : shown.length === 0 ? (
        <p className="w-full text-center text-white">
          Unknown planet “{which}”. Try {planets.map((p) => p.id).join(", ")} or all.
        </p>
      ) : (
        <div className={which === "all" ? "flex h-3/5 w-full" : "h-full w-full"}>
          {shown.map((p) => (
            <LabView
              key={p.id}
              planet={p}
              placed={layout.planets.find((l) => l.id === p.id)!}
              qa={qa}
            />
          ))}
        </div>
      )}
    </div>
  );
}
