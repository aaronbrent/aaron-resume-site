import type { PlanetBodyProps } from "../types";

/**
 * Planet body contract (docs/PLAN-STAR-SYSTEM.md §4). The scene (W2a) renders
 * one <PlanetBody> per planet; the planet designer (W2b) owns everything in
 * this folder and replaces this placeholder, keeping the export signature.
 */
export function PlanetBody({ visual, position }: PlanetBodyProps) {
  return (
    <mesh position={position as [number, number, number]}>
      <sphereGeometry args={[visual.size, 48, 32]} />
      <meshStandardMaterial color={visual.palette.base} roughness={0.8} />
    </mesh>
  );
}
