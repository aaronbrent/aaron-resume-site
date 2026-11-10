/**
 * Seeded PRNG (mulberry32) so every scattered thing in the scene — dust
 * motes, nebula offsets — is identical across runs for `?qa=1` snapshots.
 * Never use Math.random() in app/scene.
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
