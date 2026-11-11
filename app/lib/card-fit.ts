/**
 * Overflow fallback for the fixed role cards (app.css). A fixed card is
 * capped at the viewport height and can't scroll — page scroll drives the
 * camera — so if any card's content doesn't fit, every card returns to
 * normal flow (html.cards-flow), where it scrolls with the page and stays
 * fully readable. Re-checked on resize, font load and scene on/off.
 */

const ROOT_CLASS = "cards-flow";

/** True when any card's content is taller than its box (1px slack for rounding). */
export function anyOverflow(
  cards: readonly { scrollHeight: number; clientHeight: number }[],
): boolean {
  return cards.some((c) => c.scrollHeight > c.clientHeight + 1);
}

export function installCardFit(): () => void {
  const root = document.documentElement;
  const cards = Array.from(
    document.querySelectorAll<HTMLElement>("#main > [data-planet] > article"),
  );
  let frame = 0;

  const check = () => {
    frame = 0;
    // Measure in the fixed layout: drop the fallback, read, re-add if needed.
    // Synchronous within one frame, so nothing paints in between.
    root.classList.remove(ROOT_CLASS);
    const fixed = cards.length > 0 && getComputedStyle(cards[0]!).position === "fixed";
    if (fixed && anyOverflow(cards)) root.classList.add(ROOT_CLASS);
  };
  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(check);
  };

  schedule();
  window.addEventListener("resize", schedule, { passive: true });
  // The fixed layout only exists while the scene draws (data-scene="on").
  const observer = new MutationObserver(schedule);
  observer.observe(root, { attributes: true, attributeFilter: ["data-scene"] });
  void document.fonts?.ready.then(schedule);

  return () => {
    window.removeEventListener("resize", schedule);
    observer.disconnect();
    if (frame) cancelAnimationFrame(frame);
    root.classList.remove(ROOT_CLASS);
  };
}
