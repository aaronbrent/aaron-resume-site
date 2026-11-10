import { useEffect, useMemo } from "react";
import { BufferGeometry, Color, Float32BufferAttribute } from "three";
import type {} from "@react-three/fiber";
import { planets } from "~/content/planets";
import type { PlanetVisual } from "~/content/types";
import { planetPosition } from "./layout";

/** Segments per orbit: fine enough for a clean gap at each planet. */
const SEGMENTS = 512;
const COLOR = new Color("#ffd9a8");
const OPACITY = 0.22;
/** The line fades out inside GAP_INNER planet radii and is full beyond GAP_OUTER. */
const GAP_INNER = 2;
const GAP_OUTER = 6;

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

function orbit(visual: PlanetVisual): BufferGeometry {
  const r = visual.orbitRadius;
  const [px, , pz] = planetPosition(visual);
  const positions = new Float32Array(SEGMENTS * 3);
  const colors = new Float32Array(SEGMENTS * 4);
  for (let i = 0; i < SEGMENTS; i++) {
    const a = (i / SEGMENTS) * Math.PI * 2;
    const x = r * Math.cos(a);
    const z = -r * Math.sin(a);
    positions[i * 3] = x;
    positions[i * 3 + 2] = z;
    // A soft gap where the orbit passes through its planet, so the line never
    // draws across the body (it runs through the planet's centre).
    const d = Math.hypot(x - px, z - pz);
    const alpha = smoothstep(visual.size * GAP_INNER, visual.size * GAP_OUTER, d);
    colors[i * 4] = COLOR.r;
    colors[i * 4 + 1] = COLOR.g;
    colors[i * 4 + 2] = COLOR.b;
    colors[i * 4 + 3] = alpha * OPACITY;
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  // itemSize 4 → three enables per-vertex alpha for vertexColors.
  geometry.setAttribute("color", new Float32BufferAttribute(colors, 4));
  return geometry;
}

/**
 * One faint 1px circle per planet at its orbit radius in the y = 0 plane:
 * warm, low-opacity and depth-tested (but not depth-writing), so the guides
 * read as chalk lines on the system rather than wireframe.
 */
export function OrbitGuides() {
  const geometries = useMemo(() => planets.map((p) => orbit(p.visual)), []);
  useEffect(() => () => geometries.forEach((g) => g.dispose()), [geometries]);
  return (
    <group name="orbit-guides">
      {geometries.map((geometry, i) => (
        <lineLoop key={planets[i]?.id ?? i} geometry={geometry}>
          <lineBasicMaterial
            vertexColors
            transparent
            depthWrite={false}
            toneMapped={false}
          />
        </lineLoop>
      ))}
    </group>
  );
}
