import type { Config } from "@react-router/dev/config";

export default {
  // Fully static output (ADR-4): every route is prerendered at build time and
  // served as plain HTML + assets. No runtime server.
  ssr: false,
  prerender: true,
} satisfies Config;
