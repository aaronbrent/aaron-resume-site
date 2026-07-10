import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/**
 * Tier 2 — the drop-in (PLAN-3D Phase A exit criteria). Runs in its own
 * Playwright project with no stored tier preference, so the capability gate
 * resolves to ride (headless Chromium provides WebGL2 via SwiftShader).
 */

const canvasT = (page: import("@playwright/test").Page) =>
  page.evaluate(
    () => document.querySelector<HTMLCanvasElement>("[data-run-canvas]")?.dataset.t,
  );

test.describe("the drop-in (Tier 2)", () => {
  test("the tier gate mounts the 3D viewport and hides the 2D stage", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.locator("[data-run-canvas]")).toBeAttached();
    await expect(page.locator("[data-run-canvas]")).toHaveAttribute("data-ready", "true");
    await expect(page.locator("html")).toHaveAttribute("data-tier", "ride");
    await expect(page.locator("[data-stage-2d]")).toBeHidden();
  });

  test("scroll drives the camera down the line", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("[data-run-canvas][data-ready='true']")).toBeAttached();
    const atSummit = Number(await canvasT(page));
    expect(atSummit).toBeLessThan(0.1);
    await page.evaluate(() => {
      const h = document.querySelector<HTMLElement>(".run-container")!.offsetHeight;
      window.scrollTo(0, h * 0.5);
    });
    await page.waitForTimeout(1200); // smoother settles, loop parks
    const midRun = Number(await canvasT(page));
    expect(midRun).toBeGreaterThan(0.45);
    expect(midRun).toBeLessThan(0.65);
  });

  test("deep link lands the camera inside the waypoint's dwell zone", async ({
    page,
  }) => {
    await page.goto("/#public");
    await expect(page.locator("[data-run-canvas][data-ready='true']")).toBeAttached();
    await page.waitForTimeout(900);
    const t = Number(await canvasT(page));
    // Public.com anchors at t=0.45; its read bench spans several hundredths.
    expect(Math.abs(t - 0.45)).toBeLessThan(0.05);
  });

  test("reduced motion never mounts the 3D viewport", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("data-tier", "map");
    await expect(page.locator("[data-run-canvas]")).toHaveCount(0);
    await expect(page.locator("[data-stage-2d]")).toBeVisible();
  });

  test("?tier=map returns the complete v1 map with the rider rig live", async ({
    page,
  }) => {
    await page.goto("/?tier=map");
    await expect(page.locator("html")).toHaveAttribute("data-tier", "map");
    await expect(page.locator("[data-run-canvas]")).toHaveCount(0);
    await page.evaluate(() => window.scrollTo(0, 1500));
    await page.waitForTimeout(900);
    const transform = await page.evaluate(
      () => document.querySelector<HTMLElement>("[data-rider]")!.style.transform,
    );
    expect(transform).toContain("translate3d");
  });

  test("the legend toggle switches to the map and back, preserving position", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.locator("[data-run-canvas][data-ready='true']")).toBeAttached();
    const toggle = page.locator("[data-tier-toggle]");
    await toggle.scrollIntoViewIfNeeded();
    await toggle.click();
    await expect(page.locator("html")).toHaveAttribute("data-tier", "map");
    await expect(page.locator("[data-run-canvas]")).toHaveCount(0);
    // The 2D rig takes over live at the same scroll position.
    await page.waitForTimeout(600);
    const riderTransform = await page.evaluate(
      () => document.querySelector<HTMLElement>("[data-rider]")!.style.transform,
    );
    expect(riderTransform).toContain("translate3d");
    await toggle.click();
    await expect(page.locator("html")).toHaveAttribute("data-tier", "ride");
    await expect(page.locator("[data-run-canvas][data-ready='true']")).toBeAttached();
    // Both rigs derive t from the same anchor law, clamp included.
    const expectedT = await page.evaluate(() => {
      const h = document.querySelector<HTMLElement>(".run-container")!.offsetHeight;
      return Math.min(1, Math.max(0, (window.scrollY + window.innerHeight * 0.38) / h));
    });
    const backT = Number(await canvasT(page));
    expect(Math.abs(backT - expectedT)).toBeLessThan(0.01);
  });

  test("the 3D layer stays out of the accessibility tree: axe = 0", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("[data-run-canvas][data-ready='true']")).toBeAttached();
    // Resolve the one-shot gondola fade and reveal transitions before the
    // scan — axe measures blended colors on mid-transition elements.
    await page.evaluate(() => window.scrollTo(0, 60));
    await page.waitForTimeout(700);
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
    const focusables = await page
      .locator(
        '[aria-hidden="true"] a, [aria-hidden="true"] button, [aria-hidden="true"] [tabindex]',
      )
      .count();
    expect(focusables).toBe(0);
  });
});
