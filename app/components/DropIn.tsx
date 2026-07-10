import { useLayoutEffect, useRef } from "react";
import { startRig3d, type Rig3dTelemetry } from "~/lib/rig3d/rig3d";

/**
 * Tier 2's visual layer (PLAN-3D §4): the lazy-loaded 3D viewport. This
 * module (and everything it imports, including three.js) lives in its own
 * chunk — the document never waits on it. aria-hidden, pointer-events none:
 * presentation only, the flow document stays the site.
 */
export default function DropIn({
  onFrame,
  onReady,
  onFallback,
}: {
  onFrame?: (t: Rig3dTelemetry) => void;
  onReady?: () => void;
  onFallback: (reason: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hooks = useRef({ onFrame, onReady, onFallback });
  hooks.current = { onFrame, onReady, onFallback };
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    const container = document.querySelector<HTMLElement>(".run-container");
    if (!canvas || !container) return;
    return startRig3d({
      canvas,
      container,
      onFrame: (t) => hooks.current.onFrame?.(t),
      onReady: () => hooks.current.onReady?.(),
      onFallback: (reason) => hooks.current.onFallback(reason),
    });
  }, []);
  return (
    <div aria-hidden="true" role="presentation" data-print-hidden="true">
      <canvas ref={canvasRef} className="run-canvas" data-run-canvas />
    </div>
  );
}
