import type { Config } from "@react-router/dev/config";

export default {
  // Fully static output (ADR-4): every route is prerendered at build time and
  // served as plain HTML + assets. No runtime server.
  ssr: false,
  // The splat (404) route isn't discovered automatically; /404 renders it.
  prerender: ["/", "/resume", "/404", ...(process.env.LAB === "1" ? ["/lab"] : [])],
} satisfies Config;
