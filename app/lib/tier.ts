/**
 * Experience tiers (PLAN-3D ADR-6). Tier 1 is the complete v1 printed map;
 * Tier 2 is the 3D POV run. Selection uses cheap synchronous checks only —
 * the summit open (§6) can't wait on a timed probe; the first seconds of real
 * frame timings act as the probe, with live demotion on context loss.
 */

export type Tier = 1 | 2;

export const TIER_STORAGE_KEY = "aaronellis:tier";

let demoted = false;
let webgl2: boolean | undefined;

function supportsWebGL2(): boolean {
  if (webgl2 !== undefined) return webgl2;
  // API presence only: creating a real context costs hundreds of throttled
  // milliseconds on software GL, and this runs on the hydration path. An
  // actual context failure surfaces later as rig3d's onFallback → demotion.
  webgl2 = typeof WebGL2RenderingContext !== "undefined";
  return webgl2;
}

export function getTierPreference(): "map" | "ride" | null {
  try {
    const v = localStorage.getItem(TIER_STORAGE_KEY);
    return v === "map" || v === "ride" ? v : null;
  } catch {
    return null;
  }
}

/** Persists the toggle choice and re-resolves the tier everywhere. */
export function setTierPreference(pref: "map" | "ride"): void {
  try {
    localStorage.setItem(TIER_STORAGE_KEY, pref);
  } catch {
    // Private mode: the preference lives for this page view only.
  }
  demoted = false; // an explicit "ride" retries after a demotion
  window.dispatchEvent(new Event("tierchange"));
}

/** Live downgrade (context loss, init failure): Tier 1 for this session. */
export function demoteTier(): void {
  demoted = true;
  window.dispatchEvent(new Event("tierchange"));
}

export function resolveTier(): Tier {
  if (typeof window === "undefined") return 1;
  const url = new URLSearchParams(window.location.search).get("tier");
  if (url === "map") return 1;
  if (demoted) return 1;
  if (url !== "ride") {
    if (getTierPreference() === "map") return 1;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return 1;
  }
  if (!supportsWebGL2()) return 1;
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  if (memory !== undefined && memory <= 2) return 1;
  return 2;
}
