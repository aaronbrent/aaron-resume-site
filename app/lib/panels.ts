import { DWELL_FRACTION, getProgress, subscribe } from "./progress";

/**
 * Panel choreography (docs/PLAN-STAR-SYSTEM.md §5, W4). Writes a `--reveal`
 * value in [0, 1] onto the hero and each planet section from scroll
 * progress; CSS (app.css) turns it into opacity + a small lift, but only
 * while the 3D scene is on, so without it every panel is simply visible.
 */

/** Fully shown while within this many stops of the planet (its dwell). */
export const REVEAL_FULL = DWELL_FRACTION / 2;
/**
 * Approaching: hidden until this many stops out — the final approach, once
 * the camera has begun easing the planet to the right (camera-path SETTLE) —
 * then fading in to full at the dwell.
 */
export const REVEAL_APPROACH_START = 0.36;
/** Leaving: gone by this many stops past, as the camera turns away. */
export const REVEAL_DEPART_END = 0.32;

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * Reveal for a panel whose stop is `own`, with the camera at stop `stop`.
 * Asymmetric: a card fades in only on final approach to its planet, and
 * out quickly once the camera leaves.
 */
export function revealAt(stop: number, own: number): number {
  const ahead = own - stop; // > 0 while still approaching
  return ahead >= 0
    ? 1 - smoothstep(REVEAL_FULL, REVEAL_APPROACH_START, ahead)
    : 1 - smoothstep(REVEAL_FULL, REVEAL_DEPART_END, -ahead);
}

export function installPanelFades(): () => void {
  const panels = Array.from(
    document.querySelectorAll<HTMLElement>("#main > header, #main > [data-planet]"),
  );
  const stops = Math.max(1, panels.length - 1);
  const last: number[] = [];
  const apply = (progress: number) => {
    const stop = progress * stops;
    panels.forEach((el, i) => {
      // Quantize so unchanged panels skip the style write.
      const r = Math.round(revealAt(stop, i) * 100) / 100;
      if (last[i] === r) return;
      last[i] = r;
      el.style.setProperty("--reveal", String(r));
    });
  };
  const unsubscribe = subscribe(apply);
  // A deep link, reload or back/forward may have restored the scroll
  // before we attached; reveal for where we already are.
  apply(getProgress());
  return unsubscribe;
}
