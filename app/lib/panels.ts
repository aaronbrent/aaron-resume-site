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

/** Share of the viewport the footer must enter before the last card is gone. */
export const FOOTER_EXIT_SPAN = 0.35;

/**
 * 1 while the contact footer is below the viewport, falling to 0 as it
 * scrolls in. Scroll progress is clamped at the last planet through the
 * footer, so the last card needs this exit of its own.
 */
export function footerFade(footerTop: number, viewport: number): number {
  const entered = (viewport - footerTop) / (FOOTER_EXIT_SPAN * viewport);
  return 1 - Math.min(1, Math.max(0, entered));
}

export function installPanelFades(): () => void {
  const panels = Array.from(
    document.querySelectorAll<HTMLElement>("#main > header, #main > [data-planet]"),
  );
  const footer = document.querySelector<HTMLElement>("body footer");
  const stops = Math.max(1, panels.length - 1);
  const last: number[] = [];
  const apply = (progress: number) => {
    const stop = progress * stops;
    const exit = footer
      ? footerFade(footer.getBoundingClientRect().top, window.innerHeight)
      : 1;
    panels.forEach((el, i) => {
      let reveal = revealAt(stop, i);
      if (i === panels.length - 1) reveal *= exit;
      // Quantize so unchanged panels skip the style writes.
      const r = Math.round(reveal * 100) / 100;
      if (last[i] === r) return;
      last[i] = r;
      el.style.setProperty("--reveal", String(r));
      // Hidden fixed cards must not take clicks (app.css gates on this).
      el.toggleAttribute("data-revealed", r > 0);
    });
  };
  const unsubscribe = subscribe(apply);
  // Progress stops changing in the footer, so also follow raw scroll there.
  let frame = 0;
  const onScroll = () => {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      apply(getProgress());
    });
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll, { passive: true });
  // A deep link, reload or back/forward may have restored the scroll
  // before we attached; reveal for where we already are.
  apply(getProgress());
  return () => {
    unsubscribe();
    window.removeEventListener("scroll", onScroll);
    window.removeEventListener("resize", onScroll);
    if (frame) cancelAnimationFrame(frame);
  };
}
