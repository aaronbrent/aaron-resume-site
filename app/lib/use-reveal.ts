import { useEffect } from "react";

/**
 * Section reveal system (PLAN §7): one-time IntersectionObserver class toggle.
 * The hidden state only exists under `html.js` (inline snippet in root), so
 * no JS → everything simply visible. Find-in-page and anchor jumps trigger
 * native scroll → IO fires → reveals run.
 */
export function useReveal() {
  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>(".reveal"));
    if (!("IntersectionObserver" in window)) {
      for (const el of els) el.classList.add("revealed");
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("revealed");
            io.unobserve(entry.target);
          }
        }
      },
      { rootMargin: "0px 0px -10% 0px" },
    );
    for (const el of els) io.observe(el);
    return () => io.disconnect();
  }, []);
}
