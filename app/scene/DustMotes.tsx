import { useLayoutEffect, useMemo } from "react";
import { AdditiveBlending } from "three";
import { useThree } from "@react-three/fiber";
import { NEBULA_SEED } from "./constants";
import { mulberry32 } from "./random";
import { QA_TIME, useShaderTime } from "./time";

/**
 * A few hundred soft, glowing motes scattered through the orbital disc — one
 * draw call (GL points), seeded from NEBULA_SEED, drifting slowly. `qa`
 * freezes the drift.
 */

const COUNT = 420;
/** Disc the motes live in, in world units (orbits span 8–32). */
const R_MIN = 2.5;
const R_MAX = 48;

const VERTEX = /* glsl */ `
uniform float uTime;
uniform float uPixelRatio;
attribute vec4 aSeed; // phase, speed, size, tint
varying float vAlpha;
varying float vTint;
void main() {
  float t = uTime * (0.25 + 0.5 * aSeed.y);
  float ph = aSeed.x * 6.2831853;
  vec3 drift = vec3(sin(t * 0.31 + ph), sin(t * 0.23 + ph * 1.7) * 0.6, cos(t * 0.27 + ph * 0.6));
  vec4 mv = modelViewMatrix * vec4(position + drift * 0.9, 1.0);
  float depth = -mv.z;
  gl_PointSize = clamp((0.6 + 1.4 * aSeed.z) * uPixelRatio * 140.0 / depth, 1.0, 22.0 * uPixelRatio);
  // Twinkle gently; fade out right in front of the lens.
  vAlpha = (0.55 + 0.45 * sin(t * 1.3 + ph * 3.0)) * smoothstep(0.8, 4.0, depth);
  vTint = aSeed.w;
  gl_Position = projectionMatrix * mv;
}
`;

const FRAGMENT = /* glsl */ `
varying float vAlpha;
varying float vTint;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float r = length(c) * 2.0;
  float soft = smoothstep(1.0, 0.0, r);
  soft *= soft;
  vec3 warm = vec3(1.0, 0.82, 0.6);
  vec3 cool = vec3(0.6, 0.85, 1.0);
  vec3 col = mix(warm, cool, vTint) * 0.55;
  gl_FragColor = vec4(col * soft * vAlpha, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

function scatter(): { positions: Float32Array; seeds: Float32Array } {
  const rand = mulberry32(NEBULA_SEED ^ 0x9e3779b9);
  const positions = new Float32Array(COUNT * 3);
  const seeds = new Float32Array(COUNT * 4);
  for (let i = 0; i < COUNT; i++) {
    // Area-uniform in the disc, thicker further out.
    const r = Math.sqrt(R_MIN * R_MIN + rand() * (R_MAX * R_MAX - R_MIN * R_MIN));
    const a = rand() * Math.PI * 2;
    const h = (rand() + rand() + rand() - 1.5) * (1.5 + r * 0.18);
    positions[i * 3] = r * Math.cos(a);
    positions[i * 3 + 1] = h;
    positions[i * 3 + 2] = -r * Math.sin(a);
    seeds[i * 4] = rand();
    seeds[i * 4 + 1] = rand();
    seeds[i * 4 + 2] = rand();
    seeds[i * 4 + 3] = rand();
  }
  return { positions, seeds };
}

/** `count` ≤ COUNT draws a deterministic prefix of the same scatter (quality tier). */
export function DustMotes({ qa, count = COUNT }: { qa: boolean; count?: number }) {
  const dpr = useThree((s) => s.viewport.dpr);
  const all = useMemo(scatter, []);
  const { positions, seeds } = useMemo(() => {
    const n = Math.max(0, Math.min(COUNT, Math.floor(count)));
    return {
      positions: all.positions.subarray(0, n * 3),
      seeds: all.seeds.subarray(0, n * 4),
    };
  }, [all, count]);
  const time = useMemo(() => ({ value: QA_TIME }), []);
  const pixelRatio = useMemo(() => ({ value: 1 }), []);
  useLayoutEffect(() => {
    pixelRatio.value = dpr;
  }, [pixelRatio, dpr]);
  const uniforms = useMemo(
    () => ({ uTime: time, uPixelRatio: pixelRatio }),
    [time, pixelRatio],
  );
  useShaderTime(time, qa);

  return (
    <points name="dust-motes" frustumCulled={false}>
      {/* Keyed on the count so a tier change builds a fresh geometry. */}
      <bufferGeometry key={positions.length}>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-aSeed" args={[seeds, 4]} />
      </bufferGeometry>
      <shaderMaterial
        vertexShader={VERTEX}
        fragmentShader={FRAGMENT}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={AdditiveBlending}
      />
    </points>
  );
}
