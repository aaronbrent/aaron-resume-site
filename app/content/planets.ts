import type { Planet } from "./types.ts";

const deg = (d: number) => (d * Math.PI) / 180;

/**
 * The five planets (docs/PLAN-STAR-SYSTEM.md §3), inner → outer = chronological.
 * Copy for SoFi, Public.com, Empirium, and NuvaLabs is carried over verbatim
 * from the trail-map site; Topstep is new and mandate-focused.
 *
 * May 2026 → October 2026 is a real gap and stays visible — no filler.
 */
export const planets = [
  {
    id: "sofi",
    index: 0,
    nickname: "The Rewrite",
    org: "SoFi",
    role: "Frontend Engineer, SoFi Invest",
    period: { start: "2017-06", end: "2021-03" },
    claim:
      "Primary frontend engineer for SoFi Invest; led the Angular→React migration whose architecture was adopted across the organization.",
    evidence: [
      "Carried the Invest web codebase through a full Angular→React rewrite while the product kept shipping — incremental route cutover, no feature freeze.",
      "The migration architecture — module boundaries, shared design-system consumption, staged rollout — became the template other SoFi teams adopted org-wide.",
      "Built and maintained investing flows used by millions of members: brokerage onboarding, trading, and automated investing.",
    ],
    whyCare:
      "When a company-wide platform bet had to change mid-flight, he was the engineer other teams copied.",
    tech: ["typescript", "react", "angular", "leadership"],
    visual: {
      biome: "molten",
      palette: { base: "#7a1f12", accent: "#ff7a1a", atmosphere: "#ffb36b" },
      size: 0.55,
      orbitRadius: 8,
      orbitAngle: deg(20),
      hasRings: false,
      moonCount: 1,
    },
  },
  {
    id: "public",
    index: 1,
    nickname: "Corduroy",
    org: "Public.com",
    role: "Senior Software Engineer",
    period: { start: "2021-04", end: "2023-05" },
    claim:
      "Built the bond screener for an industry-leading fractional investing platform, and led the Core Web Vitals work behind measured funnel gains.",
    evidence: [
      "Designed and shipped the bond screener end-to-end: instrument filtering, yield presentation, and the entry points into the buy flow.",
      "Led the performance effort on the highest-traffic funnel pages — LCP and interaction latency down, with the gains verified in production analytics.",
      "Tied performance budgets to funnel metrics in CI, so regressions failed builds instead of showing up a quarter later.",
    ],
    whyCare: "He makes the money pages fast — and proves the speed moved the numbers.",
    tech: ["typescript", "react", "cwv", "node"],
    visual: {
      biome: "ocean",
      palette: { base: "#0f5f7a", accent: "#3fd0c9", atmosphere: "#bff3ff" },
      size: 0.8,
      orbitRadius: 13,
      orbitAngle: deg(90),
      hasRings: false,
      moonCount: 1,
    },
  },
  {
    id: "empirium",
    index: 2,
    nickname: "The Traverse",
    org: "Empirium",
    role: "Full-Stack Engineer (Contract)",
    period: { start: "2023-06", end: "2024-05" },
    claim:
      "Contract full-stack: shipped an escrow.com checkout integration end-to-end and an organization admin portal with role-based access control.",
    evidence: [
      "Built the escrow.com checkout end-to-end — API integration, payment state handling, and the customer-facing flow.",
      "Delivered the org admin portal: user management, roles and permissions (RBAC), designed to be audit-friendly from day one.",
      "Operated as a one-person full-stack team inside a client codebase: scoped it, shipped it, handed it off clean.",
    ],
    whyCare:
      "Drop him into an unfamiliar codebase with a spec and a deadline, and the feature ships.",
    tech: ["typescript", "node", "api", "payments", "rbac"],
    visual: {
      biome: "desert",
      palette: { base: "#c98f4a", accent: "#8a5cc7", atmosphere: "#f2c98f" },
      size: 0.75,
      orbitRadius: 18,
      orbitAngle: deg(160),
      hasRings: true,
      moonCount: 0,
    },
  },
  {
    id: "nuvalabs",
    index: 3,
    nickname: "Prime Face",
    org: "NuvaLabs",
    role: "Staff Software Engineer",
    period: { start: "2024-06", end: "2026-05" },
    claim:
      "Staff engineer on security-critical real-world-asset fintech: built nvPRIME end-to-end and hardened the platform's authentication and AML enforcement.",
    evidence: [
      "Designed and shipped nvPRIME end-to-end, across frontend, services, and infrastructure.",
      "Hardened authentication across Auth0 and Privy — session policy, token handling, and the account-linking edge cases where breaches live.",
      "Implemented AML enforcement controls where a mistake costs real money — compliance logic treated as production code, with tests to match.",
      "Introduced multi-agent AI development workflows to the team, raising throughput without lowering the review bar.",
    ],
    whyCare:
      "The riskiest terrain — security, compliance, real assets — is where he does his steadiest work.",
    tech: ["typescript", "node", "auth", "aml", "ai-agents", "leadership"],
    visual: {
      biome: "ice-ringed",
      palette: { base: "#b9d7ef", accent: "#ffffff", atmosphere: "#dff1ff" },
      size: 1.0,
      orbitRadius: 25,
      orbitAngle: deg(230),
      hasRings: true,
      moonCount: 2,
    },
  },
  {
    id: "topstep",
    index: 4,
    nickname: "Charts",
    role: "Staff Software Engineer",
    roleSubtitle: "Trading Platform — Charts",
    org: "Topstep",
    period: { start: "2026-10", end: "present" },
    claim:
      "Staff engineer owning the TopstepX charting engine — a framework-agnostic rendering library that powers real-time charts for thousands of active traders.",
    evidence: [
      "Owns core charting-engine architecture: layer system, hit testing, dirty-region rendering, and the public API that React, React Native, and direct consumers integrate against.",
      "Sets the 60fps performance bar — frame-budget discipline, Web Workers + SharedArrayBuffer data pipelines, and pointer responsiveness under continuous data flow.",
      "Defines visual-testing standards for the library: pixel diffing, deterministic replay, and golden-image regression.",
    ],
    whyCare:
      "Hired to set the engineering bar on the rendering system traders live inside every day.",
    tech: ["typescript", "react", "canvas", "webworkers", "performance", "leadership"],
    visual: {
      biome: "gas-giant-banded",
      palette: { base: "#e8dcc0", accent: "#4a7ba6", atmosphere: "#f5efd8" },
      size: 1.35,
      orbitRadius: 32,
      orbitAngle: deg(305),
      hasRings: false,
      moonCount: 0,
    },
  },
] as const satisfies readonly Planet[];

export type PlanetEntry = (typeof planets)[number];
