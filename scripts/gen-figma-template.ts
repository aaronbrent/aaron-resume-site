/**
 * Figma authoring template (PLAN §2): emits an SVG with the correct viewBox,
 * horizontal guide lines at each waypoint's Y, margin rails at x=40/960, and
 * slope-angle protractor marks (30°/75° envelope) to draw a replacement run
 * over. Import into Figma, draw with the pen tool, export, then run
 * trail:normalize (future) or transcribe into the generator config.
 *
 *   node scripts/gen-figma-template.ts mobile|desktop  (default: mobile)
 */
import { writeFileSync } from "node:fs";
import { trailConfigs } from "../app/lib/trail/configs.ts";

const bp = (process.argv[2] ?? "mobile") as keyof typeof trailConfigs;
const config = trailConfigs[bp];
if (!config) {
  console.error(`Unknown breakpoint: ${bp}`);
  process.exit(1);
}

const H = config.height;
const guides = config.waypoints
  .map(
    (w) => `
  <line x1="0" y1="${w.t * H}" x2="1000" y2="${w.t * H}" stroke="#3D7DB5" stroke-width="2" stroke-dasharray="12 8"/>
  <text x="12" y="${w.t * H - 12}" font-size="28" fill="#3D7DB5">${w.id} · t=${w.t}</text>`,
  )
  .join("");

// Protractor: the legal slope envelope (30°–75° from horizontal) at a few Ys.
const protractors = [0.1, 0.5, 0.9]
  .map((f) => {
    const y = f * H;
    const len = 120;
    const rays = [30, 75]
      .flatMap((deg) => {
        const rad = (deg * Math.PI) / 180;
        const dx = Math.cos(rad) * len;
        const dy = Math.sin(rad) * len;
        return [
          `<line x1="500" y1="${y}" x2="${500 + dx}" y2="${y + dy}" stroke="#E4572E" stroke-width="1.5"/>`,
          `<line x1="500" y1="${y}" x2="${500 - dx}" y2="${y + dy}" stroke="#E4572E" stroke-width="1.5"/>`,
        ];
      })
      .join("");
    return `${rays}<text x="510" y="${y - 8}" font-size="24" fill="#E4572E">30°–75°</text>`;
  })
  .join("");

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 ${H}">
  <rect width="1000" height="${H}" fill="#F4EFE3"/>
  <line x1="40" y1="0" x2="40" y2="${H}" stroke="#22303A" stroke-width="1" stroke-dasharray="4 8"/>
  <line x1="960" y1="0" x2="960" y2="${H}" stroke="#22303A" stroke-width="1" stroke-dasharray="4 8"/>
  ${guides}
  ${protractors}
</svg>
`;

const out = new URL(`../design/trail-template.${bp}.svg`, import.meta.url).pathname;
writeFileSync(out, svg);
console.log(
  `Wrote ${out} (viewBox 1000×${H}, ${config.waypoints.length} waypoint guides)`,
);
