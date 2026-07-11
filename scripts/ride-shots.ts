import { mkdirSync } from "node:fs";
import { chromium } from "@playwright/test";

/**
 * Dev-loop screenshot rig: renders the Tier 2 ride at a series of t values
 * and writes PNGs, so art-direction changes can be reviewed frame by frame
 * without a visible browser. Not part of CI — a tuning instrument, the same
 * spirit as ?hud=1.
 *
 *   pnpm tsx scripts/ride-shots.ts [baseURL] [outDir] [t,t,t...]
 */

const baseURL = process.argv[2] ?? "http://localhost:5199";
const outDir = process.argv[3] ?? "screens";
const ts = (process.argv[4] ?? "0,0.08,0.18,0.3,0.45,0.55,0.65,0.82,0.93,0.985")
  .split(",")
  .map(Number);

async function main() {
  mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
  });
  await page.goto(`${baseURL}/?gl=full`, { waitUntil: "networkidle" });
  await page.waitForSelector("[data-run-canvas][data-ready='true']", {
    timeout: 30_000,
  });
  // BARE=1: hide the document layers so only the canvas shows — for judging
  // the world itself without cards and frame over it.
  if (process.env.BARE === "1") {
    await page.addStyleTag({
      content:
        "body > * { visibility: hidden !important; } .run-canvas, .pov-rider, .pov-rider img { visibility: visible !important; }",
    });
  }
  for (const t of ts) {
    await page.evaluate((target) => {
      const container = document.querySelector<HTMLElement>(".run-container")!;
      const h = container.offsetHeight;
      // Invert scrollToT: anchorY = scrollY + innerHeight * 0.38 = t * h.
      window.scrollTo(0, Math.max(0, target * h - window.innerHeight * 0.38));
    }, t);
    await page.waitForTimeout(1100); // smoother settles, loop parks
    await page.screenshot({ path: `${outDir}/t${t.toFixed(3)}.png` });
    console.log(`t=${t.toFixed(3)} captured`);
  }
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
