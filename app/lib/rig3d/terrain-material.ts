import { Color, ShaderMaterial } from "three";

/**
 * The signature shader (PLAN-3D ADR-9, amended for the anime art direction):
 * the terrain still draws its own elevation contour lines — the printed map
 * surviving inside the painting — but whispered now, in a shadow blue over
 * the baked palette instead of ink, minor lines every 8 m and heavier index
 * lines every 40 m, antialiased with fwidth and faded before they can moiré.
 * Fog to the haze color is computed here too (custom uniforms; the material
 * stays independent of three's fog plumbing).
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
  varying vec3 vColor;
  varying float vElevation;
  varying float vViewDist;
  void main() {
    vColor = color;
    vElevation = position.y;
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

  float contour(float elevation, float interval, float aa) {
    float g = fract(elevation / interval);
    float d = min(g, 1.0 - g) * interval; // meters to the nearest line
    return 1.0 - smoothstep(0.0, aa, d);
  }

  void main() {
    float aa = fwidth(vElevation) * 1.4 + 0.02;
    // Kill the lines before screen-space density turns them into moiré.
    float legible = 1.0 - smoothstep(1.2, 3.0, fwidth(vElevation));
    float minor = contour(vElevation, 8.0, aa) * 0.07;
    float index = contour(vElevation, 40.0, aa * 1.6) * 0.11;
    vec3 shaded = mix(vColor, uLine, (minor + index) * legible);
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
