import { getStopElements, getStopPositions } from "./progress";

/**
 * Keyboard stepping between stops (docs/PLAN-STAR-SYSTEM.md §5):
 * ArrowDown / ArrowUp → next / previous stop, Home → the sun (hero),
 * End → the outermost planet.
 *
 * It only takes over when the step is at most one viewport away. Otherwise
 * (a section taller than the screen, the contact footer past the last stop)
 * the browser's own scrolling runs, so no content is ever skipped. Ignored
 * with modifiers or inside form fields. Focus follows the step, so Tab
 * continues from the panel on screen.
 */

/** Sub-pixel slack: scrollTo lands on whole pixels, layout may not. */
const EPS = 2;

/**
 * Where to scroll for `key` at `scrollY`, given each stop's scroll position
 * and the viewport height — or null to let the browser handle it.
 */
export function stepTarget(
  scrollY: number,
  stops: readonly number[],
  key: string,
  viewport: number,
): { stop: number; top: number } | null {
  if (stops.length === 0) return null;
  const last = stops.length - 1;
  switch (key) {
    case "Home":
      return { stop: 0, top: stops[0]! };
    case "End":
      return { stop: last, top: stops[last]! };
    case "ArrowDown": {
      const next = stops.findIndex((y) => y > scrollY + EPS);
      if (next === -1) return null; // past the last stop: the footer
      if (stops[next]! - scrollY > viewport + EPS) return null; // tall content first
      return { stop: next, top: stops[next]! };
    }
    case "ArrowUp": {
      let prev = -1;
      stops.forEach((y, i) => {
        if (y < scrollY - EPS) prev = i;
      });
      if (prev === -1) return null;
      if (scrollY - stops[prev]! > viewport + EPS) return null;
      return { stop: prev, top: stops[prev]! };
    }
    default:
      return null;
  }
}

function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)
  );
}

/** Installs the handler; returns an uninstall function. */
export function installKeyboardNav(): () => void {
  const onKey = (event: KeyboardEvent) => {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.shiftKey || isEditable(event.target)) return;
    const step = stepTarget(
      window.scrollY,
      getStopPositions(),
      event.key,
      window.innerHeight,
    );
    if (step === null) return;
    event.preventDefault();
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: step.top, behavior: reduced ? "auto" : "smooth" });
    // Sections carry tabindex=-1; focus without a second (instant) scroll.
    getStopElements()[step.stop]?.focus({ preventScroll: true });
  };
  window.addEventListener("keydown", onKey);
  return () => window.removeEventListener("keydown", onKey);
}
