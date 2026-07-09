import type { Skill } from "./types";

/** Legend skills (PLAN §8): grouped Frontend / Backend / Cloud / Leadership·AI. */
export const skills = [
  { id: "typescript", label: "TypeScript", group: "frontend" },
  { id: "react", label: "React", group: "frontend" },
  { id: "angular", label: "Angular", group: "frontend" },
  { id: "cwv", label: "Web performance (Core Web Vitals)", group: "frontend" },
  { id: "tailwind", label: "Tailwind CSS", group: "frontend" },
  { id: "node", label: "Node.js", group: "backend" },
  { id: "api", label: "API design", group: "backend" },
  { id: "payments", label: "Payments & escrow integrations", group: "backend" },
  { id: "rbac", label: "RBAC & permissions", group: "backend" },
  { id: "auth", label: "Auth hardening (Auth0, Privy)", group: "backend" },
  { id: "aml", label: "AML & compliance systems", group: "backend" },
  { id: "cicd", label: "CI/CD (GitHub Actions)", group: "cloud" },
  { id: "cloudflare", label: "Cloudflare Pages & Workers", group: "cloud" },
  { id: "ai-agents", label: "Multi-agent AI dev workflows", group: "leadership-ai" },
  { id: "leadership", label: "Technical leadership & mentoring", group: "leadership-ai" },
] as const satisfies readonly Skill[];

export const skillGroupLabels = {
  frontend: "Frontend",
  backend: "Backend",
  cloud: "Cloud",
  "leadership-ai": "Leadership · AI",
} as const;
