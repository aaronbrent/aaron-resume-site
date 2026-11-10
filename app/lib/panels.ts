import { subscribe } from "./progress";

/**
 * Panel choreography (docs/PLAN-STAR-SYSTEM.md §5, W4). Writes a `--reveal`
 * value in [0, 1] onto the hero and each planet section from scroll
 * progress; CSS (app.css) turns it into opacity + a small lift, but only
 * while the 3D scene is on, so without it every panel is simply visible.
 */

/** Fully shown while within this many stops of the planet (its dwell). */
export const REVEAL_FULL = 0.25;
/** Fully hidden beyond this many stops (mid-travel). */
export const REVEAL_ZERO = 0.6;

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/** Reveal for a panel whose stop is `own`, with the camera at stop `stop`. */
export function revealAt(stop: number, own: number): number {
  return 1 - smoothstep(REVEAL_FULL, REVEAL_ZERO, Math.abs(stop - own));
}

export function installPanelFades(): () => void {
  const panels = Array.from(
    document.querySelectorAll<HTMLElement>("#main > header, #main > [data-planet]"),
  );
  const stops = Math.max(1, panels.length - 1);
  const last: number[] = [];
  return subscribe((progress) => {
    const stop = progress * stops;
    panels.forEach((el, i) => {
      // Quantize so unchanged panels skip the style write.
      const r = Math.round(revealAt(stop, i) * 100) / 100;
      if (last[i] === r) return;
      last[i] = r;
      el.style.setProperty("--reveal", String(r));
    });
  });
}
