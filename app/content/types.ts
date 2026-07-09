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

/** Slot reserved — content TBD (PLAN open question #1) */
export interface ClosedTrail {
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
