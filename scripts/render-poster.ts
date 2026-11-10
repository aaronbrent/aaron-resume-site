/**
 * Renders the star-system posters from the real scene (docs/PLAN-STAR-SYSTEM.md
 * §6, W5) into public/poster/:
 *
 *   poster-landscape.jpg  1600×1000  backdrop when the 3D layer doesn't run
 *   poster-portrait.jpg    780×1688  same, for portrait screens
 *   og.jpg                1200×630   social card (keeps the hero text)
 *
 * Deterministic: `?qa=1` pins the pose, tier and shader clocks. Requires a
 * fresh `pnpm build`.   pnpm poster
 *
 * Set PLAYWRIGHT_CHROMIUM_EXECUTABLE to use a system Chromium.
 */
import { spawn } from "node:child_process";
import { mkdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const root = fileURLToPath(new URL("..", import.meta.url));
const outDir = fileURLToPath(new URL("../public/poster/", import.meta.url));
const PORT = 4400 + Math.floor(Math.random() * 400);

const variants = [
  { file: "poster-landscape.jpg", width: 1600, height: 1000, text: false },
  // A 390×844 phone at 2×, so the portrait framing matches real devices.
  { file: "poster-portrait.jpg", width: 390, height: 844, scale: 2, text: false },
  { file: "og.jpg", width: 1200, height: 630, text: true },
] as const;

async function waitForServer(url: string) {
  for (let i = 0; i < 50; i++) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`static server never came up at ${url}`);
}

async function main() {
  mkdirSync(outDir, { recursive: true });
  // sirv-cli doesn't export its bin; it is a direct dependency, so the path is stable.
  const sirv = fileURLToPath(new URL("../node_modules/sirv-cli/bin.js", import.meta.url));
  const server = spawn(
    process.execPath,
    [sirv, "build/client", "--port", String(PORT), "--quiet"],
    {
      cwd: root,
      stdio: "ignore",
    },
  );
  const base = `http://localhost:${PORT}`;
  try {
    await waitForServer(base);
    const browser = await chromium.launch({
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
    });
    for (const v of variants) {
      const page = await browser.newPage({
        viewport: { width: v.width, height: v.height },
        deviceScaleFactor: "scale" in v ? v.scale : 1,
      });
      await page.goto(`${base}/?gl=full&qa=1`);
      await page.waitForSelector("html[data-scene=on]", {
        state: "attached",
        timeout: 60_000,
      });
      // The poster *is* the backdrop: no document on top of it.
      await page.addStyleTag({
        content: v.text
          ? // Social card: name + positioning only; links and the cue are noise.
            "#main > header > p:nth-of-type(3), .scroll-cue { visibility: hidden !important; }"
          : "#main, footer { visibility: hidden !important; }",
      });
      await page.waitForTimeout(1500);
      const path = `${outDir}${v.file}`;
      await page.screenshot({ path, type: "jpeg", quality: v.text ? 85 : 78 });
      console.log(`  ${v.file.padEnd(22)} ${(statSync(path).size / 1024).toFixed(0)} kB`);
      await page.close();
    }
    await browser.close();
    console.log("✓ posters written to public/poster/");
  } finally {
    server.kill();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
