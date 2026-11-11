import { useEffect, useMemo, useRef } from "react";
import { PerspectiveCamera, Vector3 } from "three";
import { useFrame, useThree } from "@react-three/fiber";
import type { SystemLayout } from "./system-layout";

/**
 * Test probe (`?qa=1` only): writes each planet's projected screen circle
 * onto its role card as --planet-x / --planet-y / --planet-r (CSS px), so
 * e2e can assert the fixed card never covers its planet. It positions
 * nothing — role cards are fixed to the left (app.css).
 */
export function PlanetProbe({ layout }: { layout: SystemLayout }) {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const targets = useRef<{ article: HTMLElement; world: Vector3; radius: number }[]>([]);
  const scratch = useMemo(() => new Vector3(), []);
  const forward = useMemo(() => new Vector3(), []);

  useEffect(() => {
    targets.current = layout.planets.flatMap((p) => {
      const article = document.querySelector<HTMLElement>(`#${p.id} > article`);
      return article
        ? [
            {
              article,
              world: new Vector3(...p.position),
              radius: p.size,
            },
          ]
        : [];
    });
  }, [layout]);

  // After CameraRig (mounted earlier, same priority) has posed the camera.
  useFrame(() => {
    if (!(camera instanceof PerspectiveCamera)) return;
    camera.updateMatrixWorld();
    camera.getWorldDirection(forward);
    const focal = size.height / 2 / Math.tan((camera.fov * Math.PI) / 360);
    for (const t of targets.current) {
      const depth = scratch.copy(t.world).sub(camera.position).dot(forward);
      if (depth <= 0.1) continue; // behind the camera
      scratch.copy(t.world).project(camera);
      const s = t.article.style;
      s.setProperty(
        "--planet-x",
        `${((scratch.x * 0.5 + 0.5) * size.width).toFixed(1)}px`,
      );
      s.setProperty(
        "--planet-y",
        `${((-scratch.y * 0.5 + 0.5) * size.height).toFixed(1)}px`,
      );
      s.setProperty("--planet-r", `${((t.radius / depth) * focal).toFixed(1)}px`);
    }
  });

  return null;
}
