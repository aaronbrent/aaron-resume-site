import { useEffect, useState } from "react";
import { resolveTier, setTierPreference } from "~/lib/tier";

/**
 * The legend's map ⇄ ride switch (PLAN-3D ADR-6): preferring the printed map
 * is a legitimate aesthetic choice, and its presence signals confidence. The
 * button lives in the document layer — focusable, plain, patrol-accented.
 */
export function TierToggle() {
  // SSR renders the map-state label; the effect corrects it post-hydration.
  const [riding, setRiding] = useState(false);
  useEffect(() => {
    const update = () => setRiding(resolveTier() === 2);
    update();
    window.addEventListener("tierchange", update);
    return () => window.removeEventListener("tierchange", update);
  }, []);
  return (
    <button
      type="button"
      data-tier-toggle
      aria-pressed={riding}
      onClick={() => setTierPreference(riding ? "map" : "ride")}
      className="mt-4 border-2 border-patrol px-3 py-1.5 font-display text-sm font-semibold uppercase tracking-[0.15em] text-patrol-deep"
    >
      {riding ? "View the printed map" : "Ride the mountain (3D)"}
    </button>
  );
}
