import AxeBuilder from "@axe-core/playwright";
import { expect, test, type ConsoleMessage, type Page } from "@playwright/test";

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
