import { useFrame } from "@react-three/fiber";

/**
 * Shader time starts here and, under `?qa=1`, stays here: every animated
 * uniform in the scene is frozen at this phase so snapshots are identical.
 */
export const QA_TIME = 12;

/** Longest step a frame may advance (tab switches, debugger pauses). */
const MAX_STEP = 0.1;

/** Advances `uniform.value` by frame time, unless the scene is in QA mode. */
export function useShaderTime(uniform: { value: number }, qa: boolean): void {
  useFrame((_, delta) => {
    if (!qa) uniform.value += Math.min(delta, MAX_STEP);
  });
}
