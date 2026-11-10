export const site = {
  /**
   * TODO(W7): switch to the live `*.up.railway.app` URL once Aaron runs the
   * first deploy, and update public/sitemap.xml + robots.txt to match.
   */
  url: "https://aaronellis.dev",
  name: "Aaron Ellis",
  title: "Aaron Ellis — Staff Software Engineer",
  positioning:
    "Staff full-stack engineer — TypeScript, React, Node. 12 years of consumer fintech.",
  description:
    "Staff full-stack engineer — TypeScript, React, Node. 12 years in fintech and trading: SoFi, Public.com, Empirium, NuvaLabs, Topstep. The career, drawn as a star system.",
} as const;

export const contact = {
  email: "aaronbrentellis@gmail.com",
  github: "https://github.com/aaronbrent",
  /** TODO: confirm LinkedIn profile URL */
  linkedin: "https://www.linkedin.com/in/aaronbrentellis",
  resumePdf: "/aaron-ellis-resume.pdf",
} as const;
