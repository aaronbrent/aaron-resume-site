import type { Line3D } from "./types.ts";

/**
 * The 3D run (PLAN-3D §2): authored control points, world meters — x lateral,
 * y elevation, z down-mountain. Anchored points pin their ride time to the
 * waypoint's content `t` (the LUT warps time between anchors), so the camera
 * reaches each sign exactly when the hidden flow section scrolls past.
 *
 * Authoring rules the validator enforces (`pnpm line:validate`):
 * fall-line grades 8°–38°, dwell benches ≤ 4.5° at speed ≤ 0.35, descent
 * monotonic, carve tightness capped by κ·v² comfort at reference pace. The
 * warped profile puts fall-line speeds near 20–25 m/s, so S-bends stay long
 * (≥ ~180 m per direction change) and bench ramps shallow (≤ ~7°).
 */
export const line3d = {
  seed: 20260710,
  points: [
    // Summit lip — the opening shot (§6): board nose here, line dropping away.
    { p: [0, 600, 0], speed: 0.5 },
    { p: [4, 598.5, 18], speed: 0.75 },
    // Drop 1: ~20° pitch, one long right-hand arc.
    { p: [6, 584, 63] },
    { p: [8, 568, 108] },
    { p: [6, 552, 152] },
    { p: [0, 536, 195], speed: 0.6 },
    // SoFi bench.
    { p: [5, 535.2, 213], speed: 0.32 },
    { p: [8, 534.7, 225], speed: 0.25, waypointId: "sofi" },
    { p: [11, 534.2, 237], speed: 0.32 },
    { p: [14, 532, 257], speed: 0.55 },
    // Drop 2: long left-then-right S.
    { p: [8, 517, 300] },
    { p: [0, 500, 345] },
    { p: [2, 483, 390] },
    { p: [8, 467, 433], speed: 0.6 },
    // Public.com bench.
    { p: [13, 466.2, 451], speed: 0.32 },
    { p: [16, 465.7, 463], speed: 0.25, waypointId: "public" },
    { p: [19, 465.2, 475], speed: 0.32 },
    { p: [24, 463, 495], speed: 0.55 },
    // Drop 3: the traverse-flavored stretch, drifting right and back.
    { p: [38, 447, 538] },
    { p: [46, 431, 583] },
    { p: [40, 415, 628] },
    { p: [30, 400, 668], speed: 0.6 },
    // Empirium bench.
    { p: [25, 399.2, 686], speed: 0.32 },
    { p: [22, 398.7, 698], speed: 0.25, waypointId: "empirium" },
    { p: [19, 398.2, 710], speed: 0.32 },
    { p: [14, 396, 730], speed: 0.55 },
    // Drop 4: the double-black pitch, ~26°.
    { p: [10, 375, 772] },
    { p: [14, 353, 816] },
    { p: [20, 331, 860] },
    { p: [26, 313, 896], speed: 0.6 },
    // NuvaLabs bench.
    { p: [30, 312.2, 912], speed: 0.32 },
    { p: [33, 311.7, 928], speed: 0.25, waypointId: "nuvalabs" },
    { p: [36, 311.2, 944], speed: 0.32 },
    { p: [41, 309, 962], speed: 0.55 },
    // Runout: near-straight diagonal, then locked to the fall line — the
    // whole finale keeps x = 56 (κ = 0) because the anchor-warped schuss is
    // the fastest stretch of the ride and tolerates zero curvature.
    { p: [50, 294, 1004] },
    { p: [56, 279, 1048] },
    { p: [58, 264, 1092] },
    { p: [56, 253, 1120], speed: 0.5 },
    // Closed trail: a long bench sitting mostly before its anchor, where the
    // ride-time budget is generous (after t=0.955 only ~4s remain).
    { p: [56, 252.7, 1128], speed: 0.36 },
    { p: [56, 252.2, 1142], speed: 0.28 },
    { p: [56, 251.5, 1160], speed: 0.25, waypointId: "closed-trail" },
    { p: [56, 250.9, 1176], speed: 0.3 },
    { p: [56, 249.4, 1190], speed: 0.5 },
    // Final schuss into base camp — dead straight, and the hockey stop lands
    // on the brink of the valley bowl: the last meters of bench sit right at
    // the rollover, so the parked end frame looks over the town below.
    { p: [56, 239, 1214], speed: 0.9 },
    { p: [56, 231.8, 1238], speed: 0.5 },
    { p: [56, 230.2, 1256], speed: 0.32 },
    { p: [56, 229.9, 1264], speed: 0.26 },
    { p: [56, 229.7, 1270], speed: 0.25 },
  ],
} as const satisfies Line3D;
