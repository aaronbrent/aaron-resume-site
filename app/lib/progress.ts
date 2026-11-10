/**
 * Scroll progress store (docs/PLAN-STAR-SYSTEM.md §5, amendment C.1).
 *
 * Native document scroll drives the flight — no drei ScrollControls. The page
 * is 1 hero page + one page per planet; `progress ∈ [0, 1]` spans the whole
 * scrollable distance, so stop 0 is the hero and stop i + 1 is planet i.
 *
 * Read it in `useFrame` via `getProgress()` (never React state), or
 * `subscribe()` for DOM overlays. The listener attaches lazily on the client.
 */

type Listener = (progress: number) => void;

let progress = 0;
let attached = false;
let frame = 0;
const listeners = new Set<Listener>();

function measure(): number {
  const max = document.documentElement.scrollHeight - window.innerHeight;
  return max > 0 ? clamp01(window.scrollY / max) : 0;
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
  progress = measure();
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll, { passive: true });
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
