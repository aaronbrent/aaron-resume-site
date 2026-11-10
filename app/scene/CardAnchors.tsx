import { useEffect, useMemo, useRef } from "react";
import { PerspectiveCamera, Vector3 } from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { planets } from "~/content/planets";
import { anchorCard } from "./card-anchor";
import { planetPosition } from "./layout";

/**
 * Floats each role card beside its planet (docs/PLAN-STAR-SYSTEM.md §5).
 * The cards stay the prerendered <article>s in the document; on wide,
 * landscape screens CSS makes them position:fixed (app.css, "anchored
 * cards") and this writes their position each frame from the planet's
 * projected screen circle. Only revealed cards are touched, and only with
 * custom properties feeding a transform — no layout work.
 */

/** Must match the anchored-card media query in app.css. */
export const ANCHOR_QUERY =
  "(min-width: 768px) and (orientation: landscape) and (min-height: 520px)";

interface Target {
  article: HTMLElement;
  section: HTMLElement;
  world: Vector3;
  radius: number;
  size: { w: number; h: number };
}

const px = (n: number) => `${n.toFixed(1)}px`;

export function CardAnchors({ qa }: { qa: boolean }) {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const targets = useRef<Target[]>([]);
  const active = useRef(false);
  const scratch = useMemo(() => new Vector3(), []);
  const toCam = useMemo(() => new Vector3(), []);
  const forward = useMemo(() => new Vector3(), []);

  useEffect(() => {
    const found: Target[] = [];
    for (const p of planets) {
      const section = document.getElementById(p.id);
      const article = section?.querySelector<HTMLElement>(":scope > article");
      if (!section || !article) continue;
      found.push({
        article,
        section,
        world: new Vector3(...planetPosition(p.visual)),
        radius: p.visual.size,
        size: { w: article.offsetWidth, h: article.offsetHeight },
      });
    }
    targets.current = found;

    // Card sizes change with fonts, viewport width and the anchored styles.
    const observer = new ResizeObserver(() => {
      for (const t of found)
        t.size = { w: t.article.offsetWidth, h: t.article.offsetHeight };
    });
    for (const t of found) observer.observe(t.article);

    const query = window.matchMedia(ANCHOR_QUERY);
    const onQuery = () => {
      active.current = query.matches;
    };
    onQuery();
    query.addEventListener("change", onQuery);
    return () => {
      observer.disconnect();
      query.removeEventListener("change", onQuery);
      for (const t of found) {
        for (const prop of [
          "--card-x",
          "--card-y",
          "--planet-x",
          "--planet-y",
          "--planet-r",
        ])
          t.article.style.removeProperty(prop);
      }
    };
  }, []);

  // After CameraRig (mounted earlier, same priority) has posed the camera.
  useFrame(() => {
    if (!active.current || !(camera instanceof PerspectiveCamera)) return;
    camera.updateMatrixWorld();
    camera.getWorldDirection(forward);
    const focal = size.height / 2 / Math.tan((camera.fov * Math.PI) / 360);
    for (const t of targets.current) {
      // Cards that are faded out don't need placing (and qa stays exact).
      const reveal = Number(t.section.style.getPropertyValue("--reveal") || "0");
      if (reveal <= 0 && !qa) continue;
      toCam.copy(t.world).sub(camera.position);
      const depth = toCam.dot(forward);
      if (depth <= 0.1) continue; // behind the camera
      scratch.copy(t.world).project(camera);
      const x = (scratch.x * 0.5 + 0.5) * size.width;
      const y = (-scratch.y * 0.5 + 0.5) * size.height;
      const r = (t.radius / depth) * focal;
      const a = anchorCard({ x, y, r }, t.size, { w: size.width, h: size.height });
      const s = t.article.style;
      s.setProperty("--card-x", px(a.x));
      s.setProperty("--card-y", px(a.y));
      s.setProperty("--planet-x", px(x));
      s.setProperty("--planet-y", px(y));
      s.setProperty("--planet-r", px(r));
      s.setProperty("--conn-x", px(a.connector.x));
      s.setProperty("--conn-y", px(a.connector.y));
      s.setProperty("--conn-len", px(a.connector.length));
      s.setProperty("--conn-angle", `${a.connector.angle.toFixed(4)}rad`);
      t.article.dataset.anchorSide = a.side;
    }
  });

  return null;
}
