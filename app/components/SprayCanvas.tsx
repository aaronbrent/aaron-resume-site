import { useEffect, useRef, useState } from "react";

/**
 * Additive polish only: the canvas is mounted post-hydration and is omitted
 * entirely for reduced motion. Its pixels are owned by the rig, not React.
 */
export function SprayCanvas() {
  const [mounted, setMounted] = useState(false);
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setMounted(!media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => {
      media.removeEventListener("change", sync);
    };
  }, []);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    window.dispatchEvent(new CustomEvent("spraymount", { detail: canvas }));
    return () => {
      window.dispatchEvent(new Event("sprayunmount"));
    };
  }, [mounted]);

  if (!mounted) return null;
  return <canvas ref={ref} data-spray className="spray-canvas" aria-hidden="true" />;
}
