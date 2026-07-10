import { closedTrail } from "../../content/closed-trail.ts";
import { waypoints } from "../../content/waypoints.ts";
import type { LineAnchor } from "./lut3d.ts";

/**
 * The ride's time anchors come straight from the content model: each waypoint
 * (and the closed trail) pins its line bench to the same `t` that positions
 * its hidden flow section — one source of truth for scroll, document, camera.
 */
export function contentAnchors(): LineAnchor[] {
  return [
    ...waypoints.map((w) => ({ id: w.id, t: w.t })),
    { id: closedTrail.id, t: closedTrail.t },
  ];
}
