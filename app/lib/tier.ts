/**
 * Experience tiers (PLAN-3D ADR-6). Tier 1 is the complete v1 printed map;
 * Tier 2 is the 3D POV run. Synchronous checks choose a candidate tier;
 * a real context probe runs after the initial map paint and before the lazy
 * renderer import. Context loss still demotes the live experience.
 */

export type Tier = 1 | 2;

export const TIER_STORAGE_KEY = "aaronellis:tier";

let demoted = false;
let webgl2: boolean | undefined;
let rideCapability: Promise<boolean> | undefined;

function supportsWebGL2(): boolean {
  if (webgl2 !== undefined) return webgl2;
  // API presence only keeps selection cheap on the hydration path. The
  // post-paint capability probe creates and verifies the real context.
  webgl2 = typeof WebGL2RenderingContext !== "undefined";
  return webgl2;
}

function isFullGlOverride(): boolean {
  return new URLSearchParams(window.location.search).get("gl") === "full";
}

/**
 * Probes a real WebGL2 context after the initial map paint, before importing
 * the renderer chunk. This keeps the 2D fallback from downloading/parsing
 * Three.js only to discover that it is running on software GL.
 */
export function probeRideCapability(): Promise<boolean> {
  if (rideCapability) return rideCapability;
  rideCapability = new Promise((resolve) => {
    requestAnimationFrame(() => {
      try {
        const gl = document.createElement("canvas").getContext("webgl2");
        if (!gl) {
          resolve(false);
          return;
        }
        if (isFullGlOverride()) {
          gl.getExtension("WEBGL_lose_context")?.loseContext();
          resolve(true);
          return;
        }
        const info = gl.getExtension("WEBGL_debug_renderer_info");
        const name = info
          ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL))
          : String(gl.getParameter(gl.RENDERER));
        gl.getExtension("WEBGL_lose_context")?.loseContext();
        resolve(!/swiftshader|llvmpipe|softpipe|software/i.test(name));
      } catch {
        resolve(false);
      }
    });
  });
  return rideCapability;
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
  // A URL override is useful for testing and sharing a starting mode, but a
  // direct user choice should take precedence from this point forward.
  const url = new URL(window.location.href);
  if (url.searchParams.has("tier")) {
    url.searchParams.delete("tier");
    window.history.replaceState(window.history.state, "", url);
  }
  demoted = false; // an explicit "ride" retries after a demotion
  rideCapability = undefined;
  window.dispatchEvent(new Event("tierchange"));
}

/** Live downgrade (context loss, init failure): Tier 1 for this session. */
export function demoteTier(): void {
  demoted = true;
  rideCapability = undefined;
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
