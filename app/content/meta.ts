import type { RunMeta } from "./types";

/** Scroll-length constants (PLAN §2). DWELL is the one tuning constant. */
export const runMeta = {
  dwellSvh: 160,
  introSvh: 100,
  outroSvh: 140,
} as const satisfies RunMeta;

export const site = {
  /** TODO(open question #2): final domain undecided — aaronellis.dev vs aaronbrentellis.com */
  url: "https://aaronellis.dev",
  name: "Aaron Ellis",
  title: "Aaron Ellis — Staff Full-Stack Engineer",
  positioning:
    "Staff full-stack engineer — TypeScript, React, Node. 12 years of consumer fintech.",
  description:
    "Staff full-stack engineer — TypeScript, React, Node. 12 years of consumer fintech. SoFi, Public.com, NuvaLabs. The career, drawn as a trail map.",
  seasons: "Seasons 2014–2026",
} as const;

export const contact = {
  email: "aaronbrentellis@gmail.com",
  github: "https://github.com/aaronbrent",
  /** TODO: confirm LinkedIn profile URL */
  linkedin: "https://www.linkedin.com/in/aaronbrentellis",
  resumePdf: "/aaron-ellis-resume.pdf",
} as const;
