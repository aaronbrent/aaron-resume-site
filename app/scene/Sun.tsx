import { useMemo } from "react";
import { AdditiveBlending, BackSide, Color } from "three";
import type {} from "@react-three/fiber";
import { SUN_RADIUS } from "./constants";
import { SIMPLEX_3D } from "./glsl";
import { QA_TIME, useShaderTime } from "./time";

/**
 * Aaron's sun: a warm, softly boiling core whose output is well above 1.0
 * (the composer renders in half-float and tone-maps last), so Bloom's
 * luminance threshold catches it and nothing else — plus a corona shell.
 */

const SUN_VERTEX = /* glsl */ `
varying vec3 vObj;
varying vec3 vNormalW;
varying vec3 vViewDir;
varying float vRimFade;
void main() {
  vObj = position;
  // The golden limb is a close-up effect; from afar it would read as a ring.
  vec3 centre = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  vRimFade = 1.0 - smoothstep(8.0, 30.0, length(cameraPosition - centre));
  vec4 world = modelMatrix * vec4(position, 1.0);
  vNormalW = normalize(mat3(modelMatrix) * normal);
  vViewDir = normalize(cameraPosition - world.xyz);
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const SUN_FRAGMENT = /* glsl */ `
uniform float uTime;
uniform vec3 uCore;
uniform vec3 uMid;
uniform vec3 uEdge;
varying vec3 vObj;
varying vec3 vNormalW;
varying vec3 vViewDir;
varying float vRimFade;
${SIMPLEX_3D}
void main() {
  // Slow spin about +y, applied to the noise domain.
  float a = uTime * 0.035;
  mat2 spin = mat2(cos(a), -sin(a), sin(a), cos(a));
  vec3 p = vObj;
  p.xz = spin * p.xz;

  // Big lazy convection cells + finer granulation, gently "boiling".
  float cells = fbm(p * 1.6 + vec3(0.0, uTime * 0.04, 0.0));
  float grain = snoise(p * 7.0 - vec3(uTime * 0.08));
  float surface = 0.5 + 0.5 * cells;

  float mu = clamp(dot(normalize(vNormalW), normalize(vViewDir)), 0.0, 1.0);

  // Warm gradient: gold centre → orange → deep ember limb, mottled by cells.
  vec3 col = mix(uEdge, uMid, smoothstep(0.0, 0.6, mu));
  col = mix(col, uCore, smoothstep(0.5, 1.0, mu) * (0.45 + 0.55 * surface));
  col *= 0.68 + 0.5 * surface + 0.08 * grain;

  // HDR, but modest: > 1 across the disc so it blooms, low enough that a
  // full-frame close-up (W3's hero) keeps its colour and surface detail.
  col *= 1.45 + 0.5 * mu;

  // Fresnel lift at the limb — the soft, glowing "Pixar" edge. Golden and
  // bright enough (luminance > 1) that bloom haloes the limb, not just the core.
  float rim = pow(1.0 - mu, 2.6);
  col += vec3(1.0, 0.62, 0.26) * rim * 1.6 * vRimFade;

  gl_FragColor = vec4(col, 1.0);
}
`;

const CORONA_VERTEX = /* glsl */ `
varying vec3 vNormalW;
varying vec3 vViewDir;
varying float vFade;
void main() {
  // Dim the shell as the camera approaches (a full-frame halo washes the
  // shot out) and drop it entirely inside, where its back faces would wrap
  // the whole view. Up close, bloom on the limb carries the glow.
  vec3 centre = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  float shell = length(modelMatrix[0].xyz);
  float dist = length(cameraPosition - centre);
  vFade = mix(0.2, 1.0, smoothstep(1.3 * shell, 3.0 * shell, dist))
        * smoothstep(1.0 * shell, 1.15 * shell, dist);
  vec4 world = modelMatrix * vec4(position, 1.0);
  vNormalW = normalize(mat3(modelMatrix) * normal);
  vViewDir = normalize(cameraPosition - world.xyz);
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const CORONA_FRAGMENT = /* glsl */ `
uniform vec3 uColor;
uniform float uTime;
uniform float uInner;
varying vec3 vNormalW;
varying vec3 vViewDir;
varying float vFade;
void main() {
  // Back faces of the shell. Recover the projected radius (shell = 1) from
  // how squarely each face looks back at us, then fall off from the sun's
  // limb (uInner) to exactly 0 at the shell's silhouette: no visible edge.
  float facing = clamp(-dot(normalize(vNormalW), normalize(vViewDir)), 0.0, 1.0);
  float r = sqrt(max(0.0, 1.0 - facing * facing));
  float t = clamp((r - uInner) / (1.0 - uInner), 0.0, 1.0);
  // A tight bright halo hugging the limb plus a broad, faint warm haze.
  float glow = 0.55 * exp(-8.0 * t) + 0.5 * pow(1.0 - t, 2.5);
  float breathe = 1.0 + 0.05 * sin(uTime * 0.6);
  gl_FragColor = vec4(uColor * glow * breathe * vFade, 1.0);
}
`;

const CORONA_SCALE = 3.0;
const SUN_DEFINES = { OCTAVES: 4 };

export function Sun({ qa }: { qa: boolean }) {
  // One shared clock for the core and the corona.
  const time = useMemo(() => ({ value: QA_TIME }), []);
  const sunUniforms = useMemo(
    () => ({
      uTime: time,
      uCore: { value: new Color("#ffe09a") },
      uMid: { value: new Color("#ff9530") },
      uEdge: { value: new Color("#f06a22") },
    }),
    [time],
  );
  const coronaUniforms = useMemo(
    () => ({
      uTime: time,
      uInner: { value: 1 / CORONA_SCALE },
      uColor: { value: new Color("#ff8a2a").multiplyScalar(1.6) },
    }),
    [time],
  );
  useShaderTime(time, qa);

  return (
    <group name="sun">
      <mesh renderOrder={1}>
        <sphereGeometry args={[SUN_RADIUS, 96, 64]} />
        <shaderMaterial
          vertexShader={SUN_VERTEX}
          fragmentShader={SUN_FRAGMENT}
          defines={SUN_DEFINES}
          uniforms={sunUniforms}
        />
      </mesh>
      <mesh renderOrder={2} scale={CORONA_SCALE}>
        <sphereGeometry args={[SUN_RADIUS, 64, 32]} />
        <shaderMaterial
          vertexShader={CORONA_VERTEX}
          fragmentShader={CORONA_FRAGMENT}
          uniforms={coronaUniforms}
          side={BackSide}
          blending={AdditiveBlending}
          transparent
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
