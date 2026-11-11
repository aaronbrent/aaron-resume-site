import AxeBuilder from "@axe-core/playwright";
import { expect, test, type ConsoleMessage, type Page } from "@playwright/test";
import { blackFraction, MAX_BLACK_FRACTION } from "./support/frame";
import { parkAtStop, PLANETS } from "./support/scene";

// Headless Chromium here is SwiftShader; ?gl=full lets the capability probe
// accept it so the 3D layer actually loads (app/lib/capability.ts).
const SCENE_URL = "/?gl=full";
const SCENE_TIMEOUT = 15_000;

async function waitForScene(page: Page) {
  await expect(page.locator("[data-scene-root] canvas")).toHaveCount(1, {
    timeout: SCENE_TIMEOUT,
  });
  await expect(page.locator("html")).toHaveAttribute("data-scene", "on", {
    timeout: SCENE_TIMEOUT,
  });
}

test.describe("3D scene layer", () => {
  test("mounts a canvas in the scene root and flags html[data-scene=on]", async ({
    page,
  }) => {
    await page.goto(SCENE_URL);
    await waitForScene(page);
    // It stays a backdrop: inside the aria-hidden root, never interactive.
    await expect(page.locator("[data-scene-root]")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  });

  test("is not loaded under reduced motion", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    const sceneChunk = page.waitForRequest(/\/assets\/Scene-[^/]+\.js$/, {
      timeout: 3_000,
    });
    await page.goto(SCENE_URL);
    await expect(page.locator("html")).toHaveAttribute("data-scene", "off");
    await expect(sceneChunk).rejects.toThrow();
    await expect(page.locator("[data-scene-root] canvas")).toHaveCount(0);
  });

  test("unmounts under reduced motion and comes back when it is turned off", async ({
    page,
  }) => {
    await page.goto(SCENE_URL);
    await waitForScene(page);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(page.locator("[data-scene-root] canvas")).toHaveCount(0);
    await expect(page.locator("html")).toHaveAttribute("data-scene", "off");
    // Our own teardown force-loses the old context; that must not count as a
    // real context loss that keeps the scene off for good.
    await page.waitForTimeout(1_000);
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await waitForScene(page);
  });

  test("unmounts on WebGL context loss", async ({ page }) => {
    await page.goto(SCENE_URL);
    await waitForScene(page);
    await page.evaluate(() => {
      const canvas = document.querySelector<HTMLCanvasElement>(
        "[data-scene-root] canvas",
      );
      // Same context R3F created; the extension simulates a GPU reset.
      canvas?.getContext("webgl2")?.getExtension("WEBGL_lose_context")?.loseContext();
    });
    await expect(page.locator("[data-scene-root] canvas")).toHaveCount(0);
    await expect(page.locator("html")).toHaveAttribute("data-scene", "off");
  });

  test("logs no console errors or warnings", async ({ page }) => {
    const problems: string[] = [];
    const record = (msg: ConsoleMessage) => {
      if (msg.type() === "error" || msg.type() === "warning") {
        problems.push(`${msg.type()}: ${msg.text()}`);
      }
    };
    page.on("console", record);
    page.on("pageerror", (err) => problems.push(`pageerror: ${err.message}`));
    await page.goto(SCENE_URL);
    await waitForScene(page);
    // Let a few more frames run (shader compiles, composer resize).
    await page.waitForTimeout(1_000);
    expect(problems).toEqual([]);
  });

  test("has zero axe violations with the scene on", async ({ page }) => {
    await page.goto(SCENE_URL);
    await waitForScene(page);
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
});

test.describe("real-visitor rendering (no qa pinning)", () => {
  // The bug this guards: on real GPUs the old post-processing chain drew only
  // a strip of the frame. Software GL never reproduced it, and every pinned
  // ?qa=1 render hid tier changes. So: native DPR 2, natural tier, let the
  // governor settle, then check every stop draws a full frame.
  test.use({ deviceScaleFactor: 2 });

  test("every stop draws a full frame at DPR 2 after the tier settles", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await page.goto(SCENE_URL);
    await waitForScene(page);
    await page.waitForTimeout(6_000); // governor windows on software GL
    for (let k = 0; k <= PLANETS.length; k++) {
      await parkAtStop(page, k);
      await page.waitForTimeout(1_500);
      const black = await blackFraction(page);
      expect(black, `stop ${k}: ${(black * 100).toFixed(1)}% black`).toBeLessThan(
        MAX_BLACK_FRACTION,
      );
    }
  });

  test("the black-frame check itself catches a black frame", async ({ page }) => {
    await page.goto(SCENE_URL);
    await waitForScene(page);
    // Simulate the failure: everything but a left strip goes black.
    await page.addStyleTag({
      content:
        "[data-scene-root]::before { content: ''; position: fixed; inset: 0 0 0 12%; background: #000; z-index: 5; }",
    });
    expect(await blackFraction(page)).toBeGreaterThan(0.5);
  });
});

test.describe("reduced motion vs an in-flight capability probe", () => {
  test("turning on reduced motion while the probe is pending keeps the scene off", async ({
    page,
  }) => {
    // Hold back requestAnimationFrame so the WebGL probe (which resolves on
    // the next frame) is still pending when the preference changes.
    await page.addInitScript(() => {
      const w = window as unknown as { __holdRaf: boolean };
      w.__holdRaf = true;
      const raf = window.requestAnimationFrame.bind(window);
      window.requestAnimationFrame = (cb) =>
        w.__holdRaf ? (setTimeout(() => raf(cb), 1500) as unknown as number) : raf(cb);
    });
    await page.goto(SCENE_URL);
    await page.waitForTimeout(200);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.evaluate(() => {
      (window as unknown as { __holdRaf: boolean }).__holdRaf = false;
    });
    await page.waitForTimeout(4_000);
    await expect(page.locator("[data-scene-root] canvas")).toHaveCount(0);
    await expect(page.locator("html")).toHaveAttribute("data-scene", "off");
  });
});
