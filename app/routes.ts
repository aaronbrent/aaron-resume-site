import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/_index.tsx"),
  route("resume", "routes/resume.tsx"),
  // Dev-only planet lab (W2b/W5 UAT). Registered only with LAB=1, so
  // production builds never prerender or ship it.
  ...(process.env.LAB === "1" ? [route("lab", "routes/lab.tsx")] : []),
] satisfies RouteConfig;
