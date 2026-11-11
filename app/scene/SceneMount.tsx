import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { canRenderScene } from "~/lib/capability";
import { FailBoundary } from "./FailBoundary";

/**
 * The only eager scene module: it decides, after hydration, whether to fetch
 * the 3D chunk at all. Keep it free of three / R3F imports — `bundle:check`
 * fails the build if the critical path grows past budget.
 */
const Scene = lazy(() => import("./Scene"));

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

/** `html[data-scene]`: "on" once the canvas has drawn, else "off" (W4 keys off it). */
function setSceneFlag(state: "on" | "off") {
  document.documentElement.dataset.scene = state;
}

/**
 * Client-only mount for the star-system canvas. Renders nothing on the
 * server and on the hydration pass (so the prerendered HTML is untouched),
 * then lazy-loads the scene if `canRenderScene()` passes. Unmounts it again
 * if the visitor turns on reduced motion, the WebGL context is lost, or the
 * scene throws.
 */
export function SceneMount() {
  const [capable, setCapable] = useState(false);
  const [dead, setDead] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const query = window.matchMedia(REDUCED_MOTION);
    const evaluate = () => {
      canRenderScene().then(
        (ok) => {
          // A probe started before the visitor turned on reduced motion
          // may settle after it: honour the preference as it is now.
          if (!cancelled) setCapable(ok && !query.matches);
        },
        () => {
          if (!cancelled) setCapable(false);
        },
      );
    };
    evaluate();
    query.addEventListener("change", evaluate);
    return () => {
      cancelled = true;
      query.removeEventListener("change", evaluate);
    };
  }, []);

  const active = capable && !dead;
  const activeRef = useRef(false);

  // "off" whenever the canvas isn't up; "on" is set by the first frame.
  useEffect(() => {
    activeRef.current = active;
    if (!active) setSceneFlag("off");
  }, [active]);

  const onFirstFrame = useCallback(() => {
    if (activeRef.current) setSceneFlag("on");
  }, []);
  const onDead = useCallback(() => setDead(true), []);

  if (!active) return null;
  return (
    <FailBoundary onError={onDead}>
      <Suspense fallback={null}>
        <Scene onFirstFrame={onFirstFrame} onFail={onDead} />
      </Suspense>
    </FailBoundary>
  );
}
