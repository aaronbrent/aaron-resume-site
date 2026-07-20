import { Color, ShaderMaterial } from "three";

/**
 * The signature shader (PLAN-3D ADR-9, amended for the anime art direction;
 * Phase G2 adds the near field): the terrain still draws its own elevation
 * contour lines — the printed map surviving inside the painting — whispered
 * in a shadow blue over the baked palette, minor lines every 8 m and heavier
 * index lines every 40 m, antialiased with fwidth and faded before they can
 * moiré. On top of that, two ground textures keep the near snow from ever
 * being a flat gradient: a **corduroy pass** (fine groomed stripes along the
 * corridor, from the terrain builder's per-vertex groom mask + signed
 * across-track meters) and a **snow-grain** wobble (two cheap hash octaves
 * over world position). Both fade by fwidth before aliasing, so they exist
 * only at the scale the eye can resolve. Fog to the haze color is computed
 * here too (custom uniforms; the material stays independent of three's fog
 * plumbing).
 *
 * The software-GL tier keeps the flat MeshBasicMaterial path instead — the
 * §7 cut ladder's "contour shader → flat" step, decided at init.
 */

export interface ContourUniforms {
  /** Contour line color — a deeper cousin of the snow-shadow blue. */
  line: Color;
  fogColor: Color;
  fogNear: number;
  fogFar: number;
}

const vertexShader = /* glsl */ `
  attribute vec2 aGroom;
  varying vec3 vColor;
  varying float vElevation;
  varying float vViewDist;
  varying vec2 vGroom;
  varying vec2 vWorldXZ;
  void main() {
    vColor = color;
    vElevation = position.y;
    vGroom = aGroom;
    vWorldXZ = position.xz;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vViewDist = -mvPosition.z;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uLine;
  uniform vec3 uFogColor;
  uniform float uFogNear;
  uniform float uFogFar;
  varying vec3 vColor;
  varying float vElevation;
  varying float vViewDist;
  varying vec2 vGroom;
  varying vec2 vWorldXZ;

  float contour(float elevation, float interval, float aa) {
    float g = fract(elevation / interval);
    float d = min(g, 1.0 - g) * interval; // meters to the nearest line
    return 1.0 - smoothstep(0.0, aa, d);
  }

  // Cheap tileless value noise: enough for grain, never for silhouettes.
  float hashNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    float a = fract(sin(dot(i, vec2(127.1, 311.7))) * 43758.5453);
    float b = fract(sin(dot(i + vec2(1.0, 0.0), vec2(127.1, 311.7))) * 43758.5453);
    float c = fract(sin(dot(i + vec2(0.0, 1.0), vec2(127.1, 311.7))) * 43758.5453);
    float d = fract(sin(dot(i + vec2(1.0, 1.0), vec2(127.1, 311.7))) * 43758.5453);
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }

  void main() {
    float aa = fwidth(vElevation) * 1.4 + 0.02;
    // Kill the lines before screen-space density turns them into moiré.
    float legible = 1.0 - smoothstep(1.2, 3.0, fwidth(vElevation));
    float minor = contour(vElevation, 8.0, aa) * 0.07;
    float index = contour(vElevation, 40.0, aa * 1.6) * 0.11;
    vec3 shaded = mix(vColor, uLine, (minor + index) * legible);

    // Corduroy: groomer stripes every 0.45 m across the corridor, faded out
    // as soon as the stripe period nears pixel scale.
    float stripeW = fwidth(vGroom.y) / 0.45;
    float stripeFade = (1.0 - smoothstep(0.28, 0.62, stripeW)) * vGroom.x;
    if (stripeFade > 0.001) {
      float stripe = sin(vGroom.y * 13.9626); // 2π / 0.45 m
      shaded *= 1.0 - (stripe * 0.5 + 0.5) * 0.038 * stripeFade;
    }

    // Snow grain: two octaves of hash noise, strongest in the mid field —
    // near enough to resolve, far enough not to shimmer.
    float grainScale = fwidth(vWorldXZ.x) + fwidth(vWorldXZ.y);
    float grainFade = 1.0 - smoothstep(0.35, 1.1, grainScale);
    if (grainFade > 0.001) {
      float grain = hashNoise(vWorldXZ * 0.9) * 0.65 + hashNoise(vWorldXZ * 3.1) * 0.35;
      shaded *= 1.0 + (grain - 0.5) * 0.045 * grainFade;
    }

    float fogF = smoothstep(uFogNear, uFogFar, vViewDist);
    gl_FragColor = vec4(mix(shaded, uFogColor, fogF), 1.0);
  }
`;

export function createContourMaterial(u: ContourUniforms): ShaderMaterial {
  return new ShaderMaterial({
    vertexShader,
    fragmentShader,
    vertexColors: true,
    uniforms: {
      uLine: { value: u.line },
      uFogColor: { value: u.fogColor },
      uFogNear: { value: u.fogNear },
      uFogFar: { value: u.fogFar },
    },
  });
}
