import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import {
  type BufferGeometry,
  type Material,
  type Mesh,
  RingGeometry,
  SphereGeometry,
  type ShaderMaterial,
  Vector3,
} from "three";
import type { PlanetVisual } from "~/content/types";
import type { PlanetBodyProps } from "../types";
import {
  BIOME_LOOK,
  DEFAULT_DETAIL,
  moonOffset,
  QA_TIME,
  ringSegments,
  ringUv,
  sphereSegments,
  type MoonSpec,
} from "./config";
import {
  type BodyMaterial,
  createAtmosphereMaterial,
  createBodyMaterial,
  createRingMaterial,
} from "./materials";

export { DEFAULT_DETAIL, QA_TIME } from "./config";

/** Optional knobs beyond the scene contract (W5: mobile detail). */
export interface PlanetBodyExtras {
  /** Geometry detail multiplier, 0.25–1.5 (default 1 → 64×48 for big planets). */
  detail?: number;
}

function buildRingGeometry(inner: number, outer: number, detail: number): RingGeometry {
  const geo = new RingGeometry(inner, outer, ringSegments(detail), 1);
  const pos = geo.attributes.position!;
  const uv = geo.attributes.uv!;
  for (let i = 0; i < pos.count; i++) {
    const [u, v] = ringUv(pos.getX(i), pos.getY(i), inner, outer);
    uv.setXY(i, u, v);
  }
  uv.needsUpdate = true;
  return geo;
}

interface PlanetParts {
  bodyGeo: SphereGeometry;
  body: BodyMaterial;
  cloudGeo: SphereGeometry | null;
  clouds: BodyMaterial | null;
  atmosGeo: SphereGeometry;
  atmos: ShaderMaterial;
  ringGeo: RingGeometry | null;
  ring: ShaderMaterial | null;
  /** Planet center in world space, read by the ring's shadow test. */
  center: Vector3;
  moonGeo: SphereGeometry | null;
  moons: { spec: MoonSpec; material: BodyMaterial }[];
  timed: BodyMaterial[];
  dispose: () => void;
}

function buildPlanet(
  visual: PlanetVisual,
  specs: readonly MoonSpec[],
  detail: number,
): PlanetParts {
  const look = BIOME_LOOK[visual.biome];
  const { size } = visual;
  const [ws, hs] = sphereSegments(size, detail);
  const bodyGeo = new SphereGeometry(size, ws, hs);
  const body = createBodyMaterial(visual, visual.biome);
  const cloudGeo = look.clouds
    ? new SphereGeometry(size * look.clouds.scale, ws, hs)
    : null;
  const clouds = look.clouds ? createBodyMaterial(visual, "cloud", 2.3) : null;
  const atmosGeo = new SphereGeometry(size * look.atmosphereScale, ws, hs);
  const atmos = createAtmosphereMaterial(visual);
  const ringGeo = visual.hasRings
    ? buildRingGeometry(size * look.ring.inner, size * look.ring.outer, detail)
    : null;
  const center = new Vector3();
  const ring = visual.hasRings ? createRingMaterial(visual, center) : null;
  const [mw, mh] = sphereSegments(0.1, detail);
  const moonGeo = specs.length ? new SphereGeometry(1, mw, mh) : null;
  const moons = specs.map((spec, i) => ({
    spec,
    material: createBodyMaterial(
      visual,
      "moon",
      spec.seed,
      visual.palette.moons?.[i] ?? visual.palette.atmosphere,
    ),
  }));
  const timed = [body, ...(clouds ? [clouds] : [])];
  const disposables: (BufferGeometry | Material | null)[] = [
    bodyGeo,
    body,
    cloudGeo,
    clouds,
    atmosGeo,
    atmos,
    ringGeo,
    ring,
    moonGeo,
    ...moons.map((m) => m.material),
  ];
  return {
    bodyGeo,
    body,
    cloudGeo,
    clouds,
    atmosGeo,
    atmos,
    ringGeo,
    ring,
    center,
    moonGeo,
    moons,
    timed,
    dispose: () => disposables.forEach((d) => d?.dispose()),
  };
}

/**
 * One biome planet (docs/PLAN-STAR-SYSTEM.md §4): procedural Pixar-soft
 * body, optional cloud shell, additive atmosphere, rings and moons. Lit by
 * the scene's sun (point light at the origin). `qa` freezes all motion at
 * QA_TIME so screenshots are deterministic.
 */
export function PlanetBody({
  visual,
  moons,
  position,
  qa,
  detail = DEFAULT_DETAIL,
}: PlanetBodyProps & PlanetBodyExtras) {
  const look = BIOME_LOOK[visual.biome];
  const parts = useMemo(
    () => buildPlanet(visual, moons, detail),
    [visual, moons, detail],
  );
  useEffect(() => () => parts.dispose(), [parts]);

  const [px, py, pz] = position;
  useEffect(() => {
    parts.center.set(px, py, pz);
  }, [parts, px, py, pz]);

  const bodyRef = useRef<Mesh>(null);
  const cloudRef = useRef<Mesh>(null);
  const moonRefs = useRef<(Mesh | null)[]>([]);

  useFrame((state) => {
    const t = qa ? QA_TIME : state.clock.elapsedTime;
    if (bodyRef.current) bodyRef.current.rotation.y = t * look.spin;
    if (cloudRef.current && look.clouds)
      cloudRef.current.rotation.y = t * look.clouds.spin;
    for (const m of parts.timed) m.userData.uniforms.uTime.value = t;
    for (let i = 0; i < parts.moons.length; i++) {
      const mesh = moonRefs.current[i];
      const moon = parts.moons[i];
      if (!mesh || !moon) continue;
      moonOffset(moon.spec, t, mesh.position);
      mesh.rotation.y = t * 0.1;
    }
  });

  const { moonGeo } = parts;
  return (
    <group position={[px, py, pz]}>
      <group rotation={[look.tilt[0], 0, look.tilt[1]]}>
        <mesh ref={bodyRef} geometry={parts.bodyGeo} material={parts.body} />
        {parts.cloudGeo && parts.clouds && (
          <mesh ref={cloudRef} geometry={parts.cloudGeo} material={parts.clouds} />
        )}
        {parts.ringGeo && parts.ring && (
          <mesh
            geometry={parts.ringGeo}
            material={parts.ring}
            rotation={[-Math.PI / 2 + look.ring.tilt, 0, 0]}
          />
        )}
      </group>
      <mesh geometry={parts.atmosGeo} material={parts.atmos} />
      {moonGeo &&
        parts.moons.map((m, i) => (
          <mesh
            key={i}
            ref={(el) => {
              moonRefs.current[i] = el;
            }}
            geometry={moonGeo}
            material={m.material}
            scale={m.spec.radius}
          />
        ))}
    </group>
  );
}
