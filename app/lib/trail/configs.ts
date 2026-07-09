import { waypoints } from "../../content/waypoints.ts";
import type { TrailConfig } from "./generate.ts";

const specs = waypoints.map((w) => ({ id: w.id, t: w.t }));

/**
 * Per-breakpoint runs (PLAN §2): a 1440px mountain and a 390px portrait phone
 * want different lines. Mobile is taller and tighter (steeper plateaus, an
 * extra flurry of switchbacks on the long gap); desktop carves wider.
 * viewBox heights: 390×844 and 1440×900 devices at 880svh, normalized to
 * 1000 units of width.
 */
export const trailConfigs: Record<"mobile" | "desktop", TrailConfig> = {
  mobile: {
    height: 18600,
    k: 0.7,
    flipsPerGap: [3, 5, 3, 3, 3],
    waypoints: specs,
    segments: 96,
  },
  desktop: {
    height: 5400,
    k: 1.4,
    flipsPerGap: [3, 3, 3, 3, 3],
    waypoints: specs,
    segments: 72,
  },
};
