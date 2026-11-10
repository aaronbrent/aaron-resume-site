/**
 * Scroll progress store (docs/PLAN-STAR-SYSTEM.md §5, amendment C.1).
 *
 * Native document scroll drives the flight — no drei ScrollControls. The
 * document's stops are the hero header and one section per planet (children
 * of #main, each at least one viewport tall). A stop is parked when its
 * section's top meets the viewport's top; scroll is mapped piecewise-
 * linearly between those positions, so stop k is exactly on screen at stop
 * k regardless of section heights (tall mobile sections, the contact footer
 * after the last planet). `progress ∈ [0, 1]`
 * is stop / planetCount: 0 = hero, (i + 1) / planetCount = planet i.
 *
 * Read it in `useFrame` via `getProgress()` (never React state), or
 * `subscribe()` for DOM overlays. The listener attaches lazily on the client.
 */

type Listener = (progress: number) => void;

let progress = 0;
let attached = false;
let frame = 0;
const listeners = new Set<Listener>();

/** Elements that define the stops, in order: hero, then planets. */
export const STOP_SELECTOR = "#main > header, #main > [data-planet]";

let stopYs: number[] = [];

/**
 * Scroll position at which each stop element is parked: its top at the
 * viewport's top (the hero at 0), clamped to the scrollable range and kept
 * non-decreasing. Sections are ≥ 1 viewport tall, so a parked section fills
 * the screen; tall ones (phones) show their top, where the planet is framed.
 */
export function stopScrollPositions(
  boxes: readonly { top: number }[],
  maxScroll: number,
): number[] {
  let floor = 0;
  return boxes.map((b, i) => {
    const top = i === 0 ? 0 : b.top;
    const y = Math.min(maxScroll, Math.max(floor, top));
    floor = y;
    return y;
  });
}

/** Fractional stop index at `scrollY` given each stop's scroll position. */
export function stopAt(scrollY: number, ys: readonly number[]): number {
  if (ys.length < 2) return 0;
  if (scrollY <= ys[0]!) return 0;
  for (let k = 1; k < ys.length; k++) {
    const a = ys[k - 1]!;
    const b = ys[k]!;
    if (scrollY <= b) return b > a ? k - 1 + (scrollY - a) / (b - a) : k;
  }
  return ys.length - 1;
}

function measureStops() {
  const els = Array.from(document.querySelectorAll<HTMLElement>(STOP_SELECTOR));
  const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
  stopYs = stopScrollPositions(
    els.map((el) => ({ top: el.getBoundingClientRect().top + window.scrollY })),
    Math.max(0, maxScroll),
  );
}

function measure(): number {
  const stops = stopYs.length - 1;
  if (stops < 1) return 0;
  return clamp01(stopAt(window.scrollY, stopYs) / stops);
}

/** Scroll position that parks stop `k` (0 = hero); for keyboard navigation. */
export function scrollYForStop(k: number): number {
  attach();
  if (stopYs.length === 0) return 0;
  return stopYs[Math.max(0, Math.min(stopYs.length - 1, k))]!;
}

/** Current fractional stop (0 = hero, i + 1 = planet i). */
export function getStop(): number {
  return getProgress() * Math.max(1, stopYs.length - 1);
}

function onResize() {
  measureStops();
  onScroll();
}

function onScroll() {
  if (frame) return;
  frame = requestAnimationFrame(() => {
    frame = 0;
    const next = measure();
    if (next === progress) return;
    progress = next;
    for (const fn of listeners) fn(progress);
  });
}

function attach() {
  if (attached || typeof window === "undefined") return;
  attached = true;
  measureStops();
  progress = measure();
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onResize, { passive: true });
  // Late layout changes (webfonts, images) move the stops.
  if (typeof ResizeObserver !== "undefined") {
    new ResizeObserver(onResize).observe(document.body);
  }
}

/** Current progress (0 on the server). */
export function getProgress(): number {
  attach();
  return progress;
}

/** Calls `fn` with each new progress value; returns an unsubscribe function. */
export function subscribe(fn: Listener): () => void {
  attach();
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

/** Fraction of each planet's stop interval spent parked (the rest is travel). */
export const DWELL_FRACTION = 0.5;

/**
 * Planet nearest the camera at `p`, or -1 while the hero is closest.
 * `count` is the number of planets.
 */
export function planetIndexAt(p: number, count: number): number {
  const stop = Math.round(clamp01(p) * count);
  return Math.min(count - 1, stop - 1);
}

/** Progress range where planet `index` is parked (panel fully shown). */
export function dwellRange(
  index: number,
  count: number,
): { start: number; center: number; end: number } {
  const step = 1 / count;
  const center = (index + 1) * step;
  const half = (step * DWELL_FRACTION) / 2;
  return { start: clamp01(center - half), center, end: clamp01(center + half) };
}
