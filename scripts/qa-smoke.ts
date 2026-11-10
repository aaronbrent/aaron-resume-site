/**
 * Smoke test (docs/PLAN-STAR-SYSTEM.md §7): load the site in headless
 * Chromium and check that the 3D layer actually runs.
 *
 *   pnpm qa:smoke                      # serves build/client itself
 *   pnpm qa:smoke https://….up.railway.app
 *
 * Asserts: no console errors, a WebGL context, at least one rendered frame
 * (html[data-scene=on]), /resume and the PDF reachable, and — on a real GPU
 * only, since software GL (CI, containers) can't hold it — > 30 fps sampled
 * over 3 s.
 */
import { spawn, type ChildProcess } from "node:child_process";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const MIN_FPS = 30;
const SAMPLE_MS = 3_000;
const DRIVER_NOISE = /GPU stall due to ReadPixels|GL Driver Message/;

async function serveBuild(): Promise<{ url: string; server: ChildProcess }> {
  const port = 4800 + Math.floor(Math.random() * 400);
  // The production server itself (pnpm start): headers and compression too.
  const serve = fileURLToPath(new URL("./serve.mjs", import.meta.url));
  const server = spawn(process.execPath, [serve, "--port", String(port)], {
    cwd: fileURLToPath(new URL("..", import.meta.url)),
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

async function main() {
  const target = process.argv[2]?.replace(/\/$/, "");
  const served = target ? null : await serveBuild();
  const base = target ?? served!.url;
  const failures: string[] = [];
  const pass = (msg: string) => console.log(`  ✓ ${msg}`);
  const fail = (msg: string) => {
    failures.push(msg);
    console.log(`  ✗ ${msg}`);
  };

  console.log(`Smoke testing ${base}`);
  const browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
    args: ["--enable-unsafe-swiftshader"],
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const errors: string[] = [];
    page.on("console", (m) => {
      if (m.type() === "error" && !DRIVER_NOISE.test(m.text())) errors.push(m.text());
    });
    page.on("pageerror", (e) => errors.push(e.message));

    // ?gl=full: headless GL is software; let the probe accept it.
    const res = await page.goto(`${base}/?gl=full`);
    if (res?.ok()) pass(`/ → ${res.status()}`);
    else fail(`/ → ${res?.status() ?? "no response"}`);

    try {
      await page.waitForSelector("html[data-scene=on]", {
        state: "attached",
        timeout: 30_000,
      });
      pass("3D scene rendered its first frame (html[data-scene=on])");
    } catch {
      fail("3D scene never rendered a frame within 30 s");
    }

    const gl = await page.evaluate(() => {
      const canvas = document.querySelector<HTMLCanvasElement>(
        "[data-scene-root] canvas",
      );
      // The renderer's context is already bound; getContext returns it.
      const ctx = canvas?.getContext("webgl2");
      if (!ctx) return null;
      const info = ctx.getExtension("WEBGL_debug_renderer_info");
      return {
        version: String(ctx.getParameter(ctx.VERSION)),
        renderer: String(
          ctx.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : ctx.RENDERER),
        ),
      };
    });
    if (gl) pass(`WebGL context acquired (${gl.version}; ${gl.renderer})`);
    else fail("no WebGL2 context on the scene canvas");
    const softwareGl = !gl || /swiftshader|llvmpipe|softpipe|software/i.test(gl.renderer);

    // A string, not a function: tsx/esbuild would inject a __name helper
    // into named inner functions that doesn't exist in the page.
    const fps = await page.evaluate<number>(`new Promise((resolve) => {
      let frames = 0;
      const start = performance.now();
      const tick = (now) => {
        frames++;
        if (now - start < ${SAMPLE_MS}) requestAnimationFrame(tick);
        else resolve((frames * 1000) / (now - start));
      };
      requestAnimationFrame(tick);
    })`);
    if (softwareGl) pass(`fps ${fps.toFixed(1)} (not gated: software GL)`);
    else if (fps > MIN_FPS) pass(`fps ${fps.toFixed(1)} > ${MIN_FPS}`);
    else fail(`fps ${fps.toFixed(1)} ≤ ${MIN_FPS} over ${SAMPLE_MS / 1000} s`);

    const html = await (await page.request.get(`${base}/`)).text();
    const entry = /import\("(\/assets\/entry\.client-[^"]+\.js)"\)/.exec(html)?.[1];
    if (entry) {
      const r = await page.request.get(`${base}${entry}`, {
        headers: { "Accept-Encoding": "br, gzip" },
      });
      const enc = r.headers()["content-encoding"];
      if (enc === "br" || enc === "gzip") pass(`scripts served compressed (${enc})`);
      else fail(`scripts served uncompressed (content-encoding: ${enc ?? "none"})`);
    } else {
      fail("couldn't find the entry script in /");
    }

    const missing = await page.request.get(`${base}/no-such-page`);
    if (missing.status() === 404) pass("unknown paths → 404");
    else fail(`unknown paths → ${missing.status()} (expected 404)`);

    for (const path of ["/resume", "/aaron-ellis-resume.pdf"]) {
      const r = await page.request.get(`${base}${path}`);
      if (r.ok()) pass(`${path} → ${r.status()}`);
      else fail(`${path} → ${r.status()}`);
    }

    if (errors.length === 0) pass("no console errors");
    else fail(`console errors:\n      ${errors.join("\n      ")}`);
  } finally {
    await browser.close();
    served?.server.kill();
  }

  if (failures.length > 0) {
    console.log(`\n✗ ${failures.length} smoke check(s) failed`);
    process.exit(1);
  }
  console.log("\n✓ smoke test passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
