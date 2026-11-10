/**
 * Client capability checks for the star-system canvas. The page document is
 * complete without them; these only decide whether to lazy-load the 3D layer.
 * Carried over from the trail-map site's tier probe (real context, rejects
 * software GL) so a fallback visitor never downloads Three.js.
 */

/** `?gl=full` forces software GL to count as capable (CI, screenshots). */
function isFullGlOverride(): boolean {
  return new URLSearchParams(window.location.search).get("gl") === "full";
}

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

let probe: Promise<boolean> | undefined;

/**
 * Creates a real WebGL2 context after first paint and rejects software
 * renderers (SwiftShader, llvmpipe). Memoized per page view.
 */
export function probeWebGL2(): Promise<boolean> {
  if (probe) return probe;
  probe = new Promise((resolve) => {
    if (typeof window === "undefined" || typeof WebGL2RenderingContext === "undefined") {
      resolve(false);
      return;
    }
    const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
    if (memory !== undefined && memory <= 2) {
      resolve(false);
      return;
    }
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
  return probe;
}

/** Whether the 3D layer should load at all (reduced motion → never). */
export async function canRenderScene(): Promise<boolean> {
  if (prefersReducedMotion()) return false;
  return probeWebGL2();
}
