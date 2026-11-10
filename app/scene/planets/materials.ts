/**
 * The shared Pixar-soft planet material: MeshStandardMaterial patched via
 * onBeforeCompile, so the scene's point light (sun at the origin), camera
 * fill and environment all light it. The patch adds:
 *  - procedural albedo / roughness / emissive per body kind (#define PLANET_KIND)
 *  - a wrapped, warm-tinted diffuse terminator (no harsh black night side)
 *  - a palette-tinted fresnel rim + cool bounce on the night side
 * Plus small ShaderMaterials for the additive atmosphere shell and rings.
 */
import {
  AdditiveBlending,
  Color,
  DoubleSide,
  MeshStandardMaterial,
  ShaderChunk,
  ShaderMaterial,
  UniformsLib,
  UniformsUtils,
  type Vector3,
  type WebGLProgramParametersWithUniforms,
} from "three";
import type { PlanetVisual } from "~/content/types";
import { BIOME_LOOK, KIND } from "./config";
import {
  ATMOS_FRAG,
  ATMOS_VERT,
  NOISE,
  RIM,
  RING_FRAG,
  RING_VERT,
  SURFACE,
} from "./glsl";

export type BodyKind = keyof typeof KIND;

/** Uniforms shared by a body material; `uTime` is driven from useFrame. */
export interface BodyUniforms {
  uTime: { value: number };
  uBase: { value: Color };
  uAccent: { value: Color };
  uAtmos: { value: Color };
  uSeed: { value: number };
  uWrap: { value: number };
  uRim: { value: number };
}

export type BodyMaterial = MeshStandardMaterial & {
  userData: { uniforms: BodyUniforms };
};

const DIFFUSE_LAMBERT =
  "reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseContribution );";
const WRAPPED_LIGHTS = ShaderChunk.lights_physical_pars_fragment.replace(
  DIFFUSE_LAMBERT,
  "reflectedLight.directDiffuse += directLight.color * planetWrap( dot( geometryNormal, directLight.direction ) ) * BRDF_Lambert( material.diffuseContribution );",
);

function patch(shader: WebGLProgramParametersWithUniforms, uniforms: BodyUniforms) {
  Object.assign(shader.uniforms, uniforms);
  shader.vertexShader = shader.vertexShader
    .replace("#include <common>", "#include <common>\nvarying vec3 vObjPos;")
    .replace("#include <begin_vertex>", "#include <begin_vertex>\nvObjPos = position;");
  shader.fragmentShader = shader.fragmentShader
    .replace("#include <common>", `#include <common>\n${NOISE}\n${SURFACE}`)
    .replace("#include <lights_physical_pars_fragment>", WRAPPED_LIGHTS)
    .replace(
      "#include <color_fragment>",
      "#include <color_fragment>\nPlanetSurface ps = planetSurface( normalize( vObjPos ) );\ndiffuseColor.rgb = ps.albedo;\ndiffuseColor.a *= ps.alpha;",
    )
    .replace(
      "#include <roughnessmap_fragment>",
      "#include <roughnessmap_fragment>\nroughnessFactor = ps.roughness;",
    )
    .replace(
      "#include <emissivemap_fragment>",
      "#include <emissivemap_fragment>\ntotalEmissiveRadiance += ps.emissive;",
    )
    .replace("#include <opaque_fragment>", `${RIM}\n#include <opaque_fragment>`);
}

function color(hex: string): Color {
  return new Color(hex);
}

/** One reusable body material for planets, cloud shells and moons. */
export function createBodyMaterial(
  visual: PlanetVisual,
  kind: BodyKind,
  seed = 0,
): BodyMaterial {
  const look = BIOME_LOOK[visual.biome];
  const uniforms: BodyUniforms = {
    uTime: { value: 0 },
    uBase: { value: color(visual.palette.base) },
    uAccent: { value: color(visual.palette.accent) },
    uAtmos: { value: color(visual.palette.atmosphere) },
    uSeed: { value: seed },
    uWrap: { value: kind === "moon" ? 0.3 : look.wrap },
    uRim: {
      value: kind === "cloud" ? look.rim * 0.4 : kind === "moon" ? 0.25 : look.rim,
    },
  };
  const cloud = kind === "cloud";
  const material = new MeshStandardMaterial({
    metalness: 0,
    roughness: 0.85,
    transparent: cloud,
    depthWrite: !cloud,
  });
  material.defines = { PLANET_KIND: KIND[kind] };
  material.onBeforeCompile = (shader) => patch(shader, uniforms);
  material.customProgramCacheKey = () => `planet-${KIND[kind]}`;
  material.userData.uniforms = uniforms;
  return material as BodyMaterial;
}

export function createAtmosphereMaterial(visual: PlanetVisual): ShaderMaterial {
  const look = BIOME_LOOK[visual.biome];
  return new ShaderMaterial({
    uniforms: {
      uAtmos: { value: color(visual.palette.atmosphere) },
      uScale: { value: look.atmosphereScale },
      uStrength: { value: look.atmosphereStrength },
    },
    vertexShader: ATMOS_VERT,
    fragmentShader: ATMOS_FRAG,
    blending: AdditiveBlending,
    transparent: true,
    depthWrite: false,
  });
}

/**
 * Rings: desert = thin violet "dusk" ring in the accent; ice = wide
 * Saturn-style bands. `lights: true` so the scene's sun lights them too.
 */
export function createRingMaterial(
  visual: PlanetVisual,
  center: Vector3,
): ShaderMaterial {
  const ice = visual.biome === "ice-ringed";
  const { base, accent, atmosphere } = visual.palette;
  return new ShaderMaterial({
    uniforms: {
      ...UniformsUtils.clone(UniformsLib.lights),
      // desert "dusk" ring: violet accent fading to a lavender highlight
      uBase: { value: color(ice ? base : accent) },
      uAccent: {
        value: ice
          ? color(accent)
          : color(accent)
              .lerp(color(atmosphere), 0.35)
              .lerp(new Color(1, 1, 1), 0.2),
      },
      uAtmos: { value: color(ice ? atmosphere : accent) },
      uPlanetPos: { value: center },
      uPlanetRadius: { value: visual.size },
      uSeed: { value: ice ? 1.7 : 5.3 },
      uStyle: { value: ice ? 1 : 0 },
    },
    vertexShader: RING_VERT,
    fragmentShader: RING_FRAG,
    lights: true,
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
  });
}
