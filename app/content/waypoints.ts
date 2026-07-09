import type { Waypoint } from "./types";

/**
 * The four waypoints (PLAN §4). Difficulty rates the terrain — technical depth
 * and consequence of failure — not seniority or recency.
 *
 * NOTE: period start/end months are drafts pending confirmation.
 */
export const waypoints = [
  {
    id: "sofi",
    t: 0.18,
    side: "left",
    difficulty: "black",
    trailName: "The Rewrite",
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
  },
  {
    id: "public",
    t: 0.45,
    side: "right",
    difficulty: "black",
    trailName: "Corduroy",
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
  },
  {
    id: "empirium",
    t: 0.65,
    side: "left",
    difficulty: "blue",
    trailName: "The Traverse",
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
  },
  {
    id: "nuvalabs",
    t: 0.82,
    side: "right",
    difficulty: "double-black",
    trailName: "Prime Face",
    org: "NuvaLabs",
    role: "Staff Software Engineer",
    period: { start: "2024-06", end: "present" },
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
  },
] as const satisfies readonly Waypoint[];
