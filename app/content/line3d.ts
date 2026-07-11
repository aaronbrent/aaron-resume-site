import type { Line3D } from "./types.ts";

/**
 * The 3D run (PLAN-3D §2): authored control points, world meters — x lateral,
 * y elevation, z down-mountain. Anchored points pin their ride time to the
 * waypoint's content `t` (the LUT warps time between anchors), so the camera
 * reaches each sign exactly when the hidden flow section scrolls past.
 *
 * Every career bench is entered by a real junction turn: the fall line keeps
 * going (the terrain carves that decoy path), and the ride carves off onto a
 * side track — left or right matching the waypoint's content side — so each
 * benchmark reads as choosing a trail. The camera's bank and yaw derive from
 * this geometry; nothing is keyframed.
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
    { p: [4, 538, 188], speed: 0.6 },
    // SoFi junction: the run forks; carve LEFT onto the bench track.
    { p: [0, 536.2, 200], speed: 0.4 },
    { p: [-8, 535.4, 212], speed: 0.3 },
    { p: [-16, 534.8, 223], speed: 0.25, waypointId: "sofi" },
    { p: [-24, 534.2, 234], speed: 0.3 },
    { p: [-30, 533.4, 247], speed: 0.42 },
    // Exit: swing back toward the fall line into drop 2's S.
    { p: [-32, 530, 264], speed: 0.6 },
    { p: [-26, 515, 305] },
    { p: [-14, 498, 350] },
    { p: [-8, 481, 395] },
    { p: [-8, 466, 430], speed: 0.6 },
    // Public.com junction: carve RIGHT onto the bench track.
    { p: [-4, 464.4, 443], speed: 0.4 },
    { p: [4, 463.6, 455], speed: 0.3 },
    { p: [12, 463.0, 466], speed: 0.25, waypointId: "public" },
    { p: [20, 462.4, 477], speed: 0.3 },
    { p: [26, 461.6, 490], speed: 0.42 },
    // Drop 3: the traverse-flavored stretch, drifting right and back.
    { p: [30, 458, 508], speed: 0.6 },
    { p: [40, 444, 548] },
    { p: [48, 429, 592] },
    { p: [44, 414, 636] },
    { p: [38, 402, 672], speed: 0.6 },
    // Empirium junction: carve LEFT onto the bench track.
    { p: [33, 400.4, 684], speed: 0.4 },
    { p: [25, 399.6, 696], speed: 0.3 },
    { p: [17, 399.0, 707], speed: 0.25, waypointId: "empirium" },
    { p: [9, 398.4, 718], speed: 0.3 },
    { p: [3, 397.6, 731], speed: 0.42 },
    // Drop 4: the double-black pitch, ~26°.
    { p: [2, 392, 748], speed: 0.7 },
    { p: [6, 372, 792] },
    { p: [12, 350, 836] },
    { p: [18, 330, 878], speed: 0.7 },
    { p: [22, 318, 904], speed: 0.6 },
    // NuvaLabs junction: carve RIGHT onto the bench track.
    { p: [26, 316.4, 916], speed: 0.4 },
    { p: [34, 315.6, 928], speed: 0.3 },
    { p: [42, 315.0, 939], speed: 0.25, waypointId: "nuvalabs" },
    { p: [50, 314.4, 950], speed: 0.3 },
    { p: [56, 313.6, 963], speed: 0.42 },
    // Runout: merge onto the fall line — the anchor-warped schuss is the
    // fastest stretch, so its line straightens out by construction.
    { p: [58, 302, 1000] },
    { p: [58, 285, 1046] },
    { p: [57, 268, 1090] },
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
