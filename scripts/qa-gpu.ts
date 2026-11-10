/**
 * Real-GPU UAT (docs/PLAN-STAR-SYSTEM.md §7). Run this on your own machine,
 * before deploying — CI and cloud agents only have software GL, which is how
 * a real-GPU-only rendering failure once shipped past every other check.
 *
 *   pnpm build && pnpm qa:gpu              # serves the build itself
 *   pnpm qa:gpu https://….up.railway.app   # or check a live URL
 *
 * Opens a visible Chrome window (falls back to Playwright's Chromium) at
 * your display's real pixel density, loads the site exactly as a visitor
 * would (no ?qa, no ?gl override, natural quality tier), parks at every stop
 * and two mid-flight points, and for each: saves a screenshot to qa-gpu/ and
 * checks the frame was fully drawn. Fails on software GL, on any black
 * frame, on console errors, or below 30 fps.
 */
import { spawn, type ChildProcess } from "node:child_process";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium, type Browser, type Page } from "@playwright/test";
import { blackFraction, MAX_BLACK_FRACTION } from "../e2e/support/frame.ts";

const OUT = fileURLToPath(new URL("../qa-gpu/", import.meta.url));
const MIN_FPS = 30;
const DRIVER_NOISE = /GPU stall due to ReadPixels|GL Driver Message/;

/** Stops (0 = hero, i + 1 = planet i) and fractional mid-flight points. */
const POINTS: { name: string; stop: number }[] = [
  { name: "0-hero", stop: 0 },
  { name: "1-sofi", stop: 1 },
  { name: "1.5-travel", stop: 1.5 },
  { name: "2-public", stop: 2 },
  { name: "3-empirium", stop: 3 },
  { name: "3.5-travel", stop: 3.5 },
  { name: "4-nuvalabs", stop: 4 },
  { name: "5-topstep", stop: 5 },
];

async function serveBuild(): Promise<{ url: string; server: ChildProcess }> {
  const port = 5200 + Math.floor(Math.random() * 400);
  const serve = fileURLToPath(new URL("./serve.mjs", import.meta.url));
  const server = spawn(process.execPath, [serve, "--port", String(port)], {
    stdio: "ignore",
  });
  const url = `http://localhost:${port}`;
  for (let i = 0; i < 50; i++) {
    try {
      if ((await fetch(url)).ok) return { url, server };
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  server.kill();
  throw new Error("static server never came up — run `pnpm build` first");
}

/** `--headless`: exercise the script without a display (it will report software GL). */
const HEADLESS = process.argv.includes("--headless");

async function launch(): Promise<Browser> {
  const args = ["--window-size=1440,900"];
  if (HEADLESS) {
    return chromium.launch({
      headless: true,
      args,
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
    });
  }
  try {
    return await chromium.launch({ channel: "chrome", headless: false, args });
  } catch {
    console.log("  (Google Chrome not found; using Playwright's Chromium)");
    return chromium.launch({ headless: false, args });
  }
}

async function parkAt(page: Page, stop: number) {
  // No named inner functions in page code (tsx would inject __name).
  await page.evaluate((stop) => {
    const els = document.querySelectorAll<HTMLElement>(
      "#main > header, #main > [data-planet]",
    );
    const tops = Array.from(els, (el, i) =>
      i === 0 ? 0 : el.getBoundingClientRect().top + window.scrollY,
    );
    const k = Math.floor(stop);
    const f = stop - k;
    const y = f === 0 ? tops[k]! : tops[k]! + (tops[k + 1]! - tops[k]!) * f;
    window.scrollTo({ top: y, behavior: "instant" });
  }, stop);
}

async function main() {
  const target = process.argv
    .slice(2)
    .find((a) => !a.startsWith("--"))
    ?.replace(/\/$/, "");
  const served = target ? null : await serveBuild();
  const base = target ?? served!.url;
  mkdirSync(OUT, { recursive: true });
  const failures: string[] = [];
  const row = (ok: boolean, msg: string) => {
    if (!ok) failures.push(msg);
    console.log(`  ${ok ? "✓" : "✗"} ${msg}`);
  };

  console.log(`Real-GPU check of ${base}`);
  const browser = await launch();
  try {
    // viewport: null → the real window, at the display's real DPR.
    const page = await browser.newPage(
      HEADLESS ? { viewport: { width: 1440, height: 900 } } : { viewport: null },
    );
    const errors: string[] = [];
    page.on("console", (m) => {
      if (m.type() === "error" && !DRIVER_NOISE.test(m.text())) errors.push(m.text());
    });
    page.on("pageerror", (e) => errors.push(e.message));

    // Headless self-test runs on software GL, which the probe rejects unless
    // overridden. Real runs load the page exactly as a visitor does.
    await page.goto(`${base}/${HEADLESS ? "?gl=full" : ""}`);
    try {
      await page.waitForSelector("html[data-scene=on]", {
        state: "attached",
        timeout: 30_000,
      });
    } catch {
      const reduced = await page.evaluate(
        () => matchMedia("(prefers-reduced-motion: reduce)").matches,
      );
      throw new Error(
        reduced
          ? "the 3D scene didn't start: this machine has Reduce Motion turned on (System Settings → Accessibility → Display). Turn it off for this check."
          : "the 3D scene didn't start within 30 s (the capability probe may have rejected this GPU). Check the browser console.",
      );
    }
    const gpu = await page.evaluate(() => {
      const gl = document.createElement("canvas").getContext("webgl2");
      const info = gl?.getExtension("WEBGL_debug_renderer_info");
      return {
        renderer: gl
          ? String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER))
          : "none",
        dpr: window.devicePixelRatio,
        size: `${window.innerWidth}×${window.innerHeight}`,
      };
    });
    console.log(`  GPU: ${gpu.renderer}`);
    console.log(`  Window: ${gpu.size} @ ${gpu.dpr}x`);
    row(
      !/swiftshader|llvmpipe|softpipe|software/i.test(gpu.renderer),
      "hardware GPU in use",
    );

    // Let the quality governor settle, then measure at the hero.
    await page.waitForTimeout(6_000);
    // A string: tsx/esbuild would wrap a named inner function in __name,
    // which doesn't exist in the page.
    const fps = await page.evaluate<number>(`new Promise((resolve) => {
      let frames = 0;
      const start = performance.now();
      const tick = (now) => {
        frames++;
        if (now - start < 3000) requestAnimationFrame(tick);
        else resolve((frames * 1000) / (now - start));
      };
      requestAnimationFrame(tick);
    })`);
    const tier = await page.evaluate(() => document.documentElement.dataset.sceneTier);
    console.log(`  Quality tier settled at ${tier} (2 = full)`);
    row(fps > MIN_FPS, `${fps.toFixed(0)} fps at the hero (needs > ${MIN_FPS})`);

    for (const point of POINTS) {
      await parkAt(page, point.stop);
      await page.waitForTimeout(2_000); // camera easing + fades
      await page.screenshot({ path: `${OUT}${point.name}.png` });
      const black = await blackFraction(page);
      row(
        black < MAX_BLACK_FRACTION,
        `${point.name.padEnd(12)} full frame (${(black * 100).toFixed(1)}% black) → qa-gpu/${point.name}.png`,
      );
    }
    row(
      errors.length === 0,
      errors.length
        ? `console errors:\n      ${errors.join("\n      ")}`
        : "no console errors",
    );
  } finally {
    await browser.close();
    served?.server.kill();
  }

  if (failures.length) {
    console.log(
      `\n✗ ${failures.length} check(s) failed — look at the screenshots in qa-gpu/`,
    );
    process.exit(1);
  }
  console.log(
    "\n✓ real-GPU check passed — screenshots are in qa-gpu/ if you want to eyeball them",
  );
}

main().catch((error) => {
  console.error(`\n✗ ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
