import { useMemo } from "react";
import { BackSide, Color, Vector3 } from "three";
import type {} from "@react-three/fiber";
import { NEBULA_SEED } from "./constants";
import { SIMPLEX_3D } from "./glsl";
import { mulberry32 } from "./random";

/**
 * Painterly nebula backdrop: a BackSide sphere pinned to the camera (so it
 * reads as infinitely far away — no parallax) and drawn at the far plane.
 * Domain-warped fbm in soft purples, blues and teals, plus a sprinkle of
 * faint stars. Fully procedural and static: the look is a pure function of
 * NEBULA_SEED, so `?qa=1` renders are identical run to run.
 */

const VERTEX = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = position;
  vec4 clip = projectionMatrix * viewMatrix * vec4(position * 400.0 + cameraPosition, 1.0);
  // Pin to the far plane: never occludes anything, never clipped.
  gl_Position = clip.xyww;
}
`;

const FRAGMENT = /* glsl */ `
uniform vec3 uOffset;
uniform vec3 uBandAxis;
uniform vec3 uDeep;
uniform vec3 uPurple;
uniform vec3 uBlue;
uniform vec3 uTeal;
uniform vec3 uRose;
varying vec3 vDir;
${SIMPLEX_3D}

// Hoskins hash (no sin()): stable star placement.
vec3 hash33(vec3 p) {
  p = fract(p * vec3(0.1031, 0.1030, 0.0973));
  p += dot(p, p.yxz + 33.33);
  return fract((p.xxy + p.yxx) * p.zyx);
}

float stars(vec3 d, float scale, float density) {
  vec3 cell = floor(d * scale);
  vec3 h = hash33(cell);
  if (h.x > density) return 0.0;
  vec3 centre = (cell + 0.25 + 0.5 * h) / scale;
  float dist = length(d - normalize(centre)) * scale;
  return smoothstep(0.3, 0.0, dist) * (0.25 + 0.75 * h.y * h.y);
}

void main() {
  vec3 d = normalize(vDir);
  vec3 p = d * 0.8 + uOffset;

  // Gentle domain warp → big, soft, brushy masses (strong warps marble).
  vec3 q = vec3(fbm(p * 0.7), fbm(p * 0.7 + vec3(5.2, 1.3, 2.8)), 0.0);
  float dens = fbm(p * 1.1 + 0.9 * q);
  float dens2 = fbm(p * 0.8 - 0.9 * q.yxz + vec3(4.0));
  // Large-scale hue field: which regions lean teal and which lean violet.
  float hue = smoothstep(-0.7, 0.05, snoise(p * 0.45 + vec3(11.0)));

  // A tilted milky band where the gas gathers; open dark sky away from it.
  float lat = dot(d, uBandAxis);
  float band = exp(-lat * lat * 3.0);

  // Base sky: deep indigo, lifting softly toward the band.
  vec3 col = mix(uDeep, uBlue, 0.3 * band);

  // Main gas, wide soft edges; violet in one hue region, teal in the other.
  float gas = smoothstep(-0.2, 0.7, dens) * (0.15 + 0.85 * band);
  vec3 gasCol = mix(uTeal, uPurple, hue) * 1.35;
  col = mix(col, gasCol, gas * 0.75);

  // A second, thinner veil in the counter-colour, so masses overlap in layers.
  float veil = smoothstep(-0.1, 0.7, dens2) * (0.25 + 0.75 * band) * (1.0 - 0.5 * gas);
  col = mix(col, mix(uPurple, uTeal, hue), veil * 0.35);

  // Luminous rose cores in the densest knots (still far below bloom).
  float core = smoothstep(0.3, 0.9, gas + 0.3 * dens2) * (0.4 + 0.6 * hue);
  col += uRose * core * 0.75;

  // Sparse, soft stars; gas dims those behind it, for depth.
  float s = stars(d, 150.0, 0.028) + 0.6 * stars(d, 340.0, 0.016);
  col += vec3(1.0, 0.95, 0.88) * s * (0.6 - 0.45 * gas);

  gl_FragColor = vec4(col, 1.0);
}
`;

const DEFINES = { OCTAVES: 4 };

export function Nebula() {
  const uniforms = useMemo(() => {
    const rand = mulberry32(NEBULA_SEED);
    const offset = new Vector3(rand() * 100 - 50, rand() * 100 - 50, rand() * 100 - 50);
    // Mostly "up", tilted a little so the band crosses the frame diagonally.
    const axis = new Vector3(rand() * 0.6 - 0.3, 1, rand() * 0.6 - 0.3).normalize();
    return {
      uOffset: { value: offset },
      uBandAxis: { value: axis },
      uDeep: { value: new Color("#0a0a22") },
      uPurple: { value: new Color("#57308a") },
      uBlue: { value: new Color("#1d3170") },
      uTeal: { value: new Color("#1d6680") },
      uRose: { value: new Color("#9a4c8e") },
    };
  }, []);

  return (
    <mesh name="nebula" frustumCulled={false} renderOrder={-1}>
      <sphereGeometry args={[1, 64, 32]} />
      <shaderMaterial
        vertexShader={VERTEX}
        fragmentShader={FRAGMENT}
        defines={DEFINES}
        uniforms={uniforms}
        side={BackSide}
        depthWrite={false}
      />
    </mesh>
  );
}
