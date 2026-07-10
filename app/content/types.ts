/** Content schema (PLAN §4). Typed TS data; `tsc` + content tests are the validator. */

export type Difficulty = "green" | "blue" | "black" | "double-black";

export type SkillGroup = "frontend" | "backend" | "cloud" | "leadership-ai";

export type SkillId =
  | "typescript"
  | "react"
  | "angular"
  | "cwv"
  | "tailwind"
  | "node"
  | "api"
  | "payments"
  | "rbac"
  | "auth"
  | "aml"
  | "cicd"
  | "cloudflare"
  | "ai-agents"
  | "leadership";

export interface Skill {
  id: SkillId;
  label: string;
  group: SkillGroup;
}

export interface Waypoint {
  /** Anchor + deep link: /#sofi */
  id: string;
  /** Normalized position along the run, ∈ (0, 1) */
  t: number;
  /** Desktop content placement (mobile: always full-width card) */
  side: "left" | "right";
  difficulty: Difficulty;
  /** The run's name on the map */
  trailName: string;
  org: string;
  role: string;
  period: { start: string; end: string | "present" };
  /** One sentence: what I did that mattered */
  claim: string;
  /** 2–4 bullets, concrete, numbers where honest */
  evidence: string[];
  /** One sentence aimed at a non-engineer */
  whyCare: string;
  /** Legend cross-refs */
  tech: SkillId[];
}

/** The ride up: education + personal projects */
export interface GondolaCredit {
  year: string;
  label: string;
}

/** A short, honest postscript to the career run (PLAN Phase 5). */
export interface ClosedTrail {
  /** Anchor + visual-map position. Kept after the career waypoints. */
  id: string;
  t: number;
  trailName: string;
  story: string;
  period: string;
}

export interface RunMeta {
  /** The one scroll-length tuning constant */
  dwellSvh: number;
  introSvh: number;
  outroSvh: number;
}

/** A control point on the 3D line (PLAN-3D §2). */
export interface LinePoint {
  /** World meters: x lateral, y elevation, z down-mountain. */
  p: readonly [number, number, number];
  /** Speed-profile multiplier; dwell benches ≈ 0.25. Default 1. */
  speed?: number;
  /**
   * Pins this point's ride time to the waypoint's content `t`, so the camera
   * passes the sign exactly when the hidden flow section scrolls past.
   */
  waypointId?: string;
}

/** The authored 3D run (PLAN-3D §2): typed control points, deterministic world. */
export interface Line3D {
  points: readonly LinePoint[];
  /** Terrain noise seed — server, client, and CI build the same mountain. */
  seed: number;
}
