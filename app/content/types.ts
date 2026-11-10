/** Content schema (docs/PLAN-STAR-SYSTEM.md §3). Typed TS data; `tsc` + content tests are the validator. */

export type SkillGroup = "frontend" | "backend" | "cloud" | "leadership-ai";

export type SkillId =
  | "typescript"
  | "react"
  | "angular"
  | "cwv"
  | "tailwind"
  | "canvas"
  | "webworkers"
  | "performance"
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

export type PlanetId = "sofi" | "public" | "empirium" | "nuvalabs" | "topstep";

export type Biome = "molten" | "ocean" | "desert" | "ice-ringed" | "gas-giant-banded";

/** "YYYY-MM" */
export type YearMonth = `${number}-${number}`;

export interface PlanetVisual {
  biome: Biome;
  palette: { base: string; accent: string; atmosphere: string };
  /** Radius in scene units, relative to the sun (SUN_RADIUS = 1). */
  size: number;
  /** Distance from the sun in scene units. Strictly increasing inner → outer. */
  orbitRadius: number;
  /**
   * Fixed angle on the orbit in radians (0 = +x, counter-clockwise seen from
   * above). Planets never orbit, so the camera's dwell points stay put.
   */
  orbitAngle: number;
  hasRings: boolean;
  moonCount: 0 | 1 | 2;
}

export interface Planet {
  /** Anchor + deep link: /#topstep */
  id: PlanetId;
  /** Orbit order (inner → outer = chronological). Always equals array position. */
  index: 0 | 1 | 2 | 3 | 4;
  /** The planet's name in the scene ("The Rewrite"). */
  nickname: string;
  role: string;
  /** Optional secondary line under the role. */
  roleSubtitle?: string;
  org: string;
  period: { start: YearMonth; end: YearMonth | "present" };
  /** One sentence: what I did that mattered */
  claim: string;
  /** 2–4 bullets, concrete, numbers where honest */
  evidence: readonly string[];
  /** One sentence aimed at a non-engineer */
  whyCare: string;
  tech: readonly SkillId[];
  visual: PlanetVisual;
}

/** Education + personal projects (shown on /resume). */
export interface EducationCredit {
  year: string;
  label: string;
}
