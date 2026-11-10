import { getStop, scrollYForStop } from "./progress";

/**
 * Keyboard stepping between stops (docs/PLAN-STAR-SYSTEM.md §5):
 * ArrowDown / ArrowUp → next / previous stop, Home → the sun (hero),
 * End → the outermost planet. Ignored with modifiers or inside form fields,
 * so native behaviour is never hijacked where it matters.
 */

export type NavKey = "ArrowDown" | "ArrowUp" | "Home" | "End";

/** The stop to go to from fractional stop `current`, or null to ignore. */
export function nextStop(current: number, key: string, lastStop: number): number | null {
  const here = Math.round(current);
  switch (key) {
    case "ArrowDown":
      // Between stops, "down" means the next one ahead.
      return Math.min(lastStop, current < here ? here : here + 1);
    case "ArrowUp":
      return Math.max(0, current > here ? here : here - 1);
    case "Home":
      return 0;
    case "End":
      return lastStop;
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

/** Installs the handler; returns an uninstall function. `lastStop` = planet count. */
export function installKeyboardNav(lastStop: number): () => void {
  const onKey = (event: KeyboardEvent) => {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.shiftKey || isEditable(event.target)) return;
    const target = nextStop(getStop(), event.key, lastStop);
    if (target === null) return;
    event.preventDefault();
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({
      top: scrollYForStop(target),
      behavior: reduced ? "auto" : "smooth",
    });
  };
  window.addEventListener("keydown", onKey);
  return () => window.removeEventListener("keydown", onKey);
}
