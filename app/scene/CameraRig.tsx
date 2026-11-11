import { useEffect, useMemo, useRef } from "react";
import { PerspectiveCamera, Vector3 } from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { planets } from "~/content/planets";
import { installKeyboardNav } from "~/lib/keyboard-nav";
import { getProgress } from "~/lib/progress";
import { buildCameraPath, rigFov } from "./camera-path";

/**
 * Scroll-driven camera (docs/PLAN-STAR-SYSTEM.md §5, W3). Reads scroll
 * progress every frame (never React state), maps it through the camera path
 * and eases the camera toward the result. In `qa` mode it snaps exactly, so
 * a snapshot is a pure function of scroll position + viewport.
 */

/** Exponential smoothing rate (1/s); higher = snappier follow. */
const FOLLOW_RATE = 5.5;

export function CameraRig({ qa }: { qa: boolean }) {
  const camera = useThree((s) => s.camera);
  const aspect = useThree((s) => s.size.width / Math.max(1, s.size.height));
  const invalidate = useThree((s) => s.invalidate);
  const portrait = aspect < 1;
  const path = useMemo(() => buildCameraPath(planets, { portrait }), [portrait]);

  const goalPos = useRef(new Vector3());
  const goalTarget = useRef(new Vector3());
  const target = useRef(new Vector3());
  const primed = useRef(false);

  // Lens + an exact first pose whenever the framing changes.
  useEffect(() => {
    if (camera instanceof PerspectiveCamera) {
      camera.fov = rigFov({ portrait });
      camera.updateProjectionMatrix();
    }
    primed.current = false;
    invalidate();
  }, [camera, portrait, invalidate]);

  useEffect(() => installKeyboardNav(), []);

  useFrame((_, delta) => {
    path.poseInto(getProgress(), goalPos.current, goalTarget.current);
    if (qa || !primed.current) {
      camera.position.copy(goalPos.current);
      target.current.copy(goalTarget.current);
      primed.current = true;
    } else {
      // Frame-rate independent ease; clamp delta so a background tab
      // returning doesn't teleport through the system.
      const k = 1 - Math.exp(-FOLLOW_RATE * Math.min(delta, 0.1));
      camera.position.lerp(goalPos.current, k);
      target.current.lerp(goalTarget.current, k);
    }
    camera.lookAt(target.current);
  });

  return null;
}
