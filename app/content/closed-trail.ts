import type { ClosedTrail } from "./types";

/**
 * Phase 5's closed trail. This stays deliberately small: it is a postscript,
 * not another resume entry. The factual copy comes from the existing gondola
 * credit and should receive one final owner read before the public launch.
 *
 * `t` sits in the outro runout, far enough below the last (and tallest)
 * waypoint that the single-column mobile card clears it — the run collapses
 * to one column under 768px, so the postscript must not land on top of
 * NuvaLabs. The content test guards that clearance.
 */
export const closedTrail = {
  id: "closed-trail",
  t: 0.955,
  trailName: "My Menu Plans",
  period: "2014–2017",
  story:
    "I built, ran, and sunset a meal-planning product solo. It taught me that a product's real shape emerges after launch — through maintenance, tradeoffs, and the decision to stop.",
} as const satisfies ClosedTrail;
