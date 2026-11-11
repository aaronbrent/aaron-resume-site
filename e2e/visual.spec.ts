import { expect, test } from "@playwright/test";
import { blackFraction, MAX_BLACK_FRACTION } from "./support/frame";
import { parkAtStop, PLANETS, QA_URL, waitForScene } from "./support/scene";

/**
 * Visual regression of the 3D layer (docs/PLAN-STAR-SYSTEM.md §7) at scroll
 * progress 0 / 20 / 40 / 60 / 80 / 100 % — exactly the hero and the five
 * planet stops. `?qa=1` makes each frame a pure function of pose + viewport.
 * The document is hidden (not removed, so scroll positions hold): text
 * rendering varies with fonts across machines and is covered functionally.
 *
 * Baselines are Linux-only (SwiftShader). Update with:
 *   pnpm qa:visual --update-snapshots
 */
const STOPS = ["hero", ...PLANETS.map((p) => p.id)];

test.describe("scene visual regression", () => {
  // Baselines are Linux/SwiftShader renders (CI). Other platforms rasterise
  // differently and have no baselines, so the suite only runs on Linux.
  test.skip(process.platform !== "linux", "visual baselines are Linux-only (CI)");
  test.describe.configure({ mode: "serial" });
  // 1× keeps baselines small and fast; the phone viewport/framing is kept.
  test.use({ deviceScaleFactor: 1 });
  // Scene load + a stable screenshot on a small CI runner's software GL.
  test.describe.configure({ timeout: 60_000 });

  for (const [k, name] of STOPS.entries()) {
    test(`${(k * 20).toString().padStart(3, "0")}% — ${name}`, async ({ page }) => {
      await page.goto(QA_URL);
      await waitForScene(page);
      await page.addStyleTag({
        content: "#main, footer { visibility: hidden !important; }",
      });
      await parkAtStop(page, k);
      // A full frame first: a baseline can't bless a half-drawn one.
      expect(await blackFraction(page)).toBeLessThan(MAX_BLACK_FRACTION);
      await expect(page).toHaveScreenshot(`stop-${k}-${name}.png`, {
        maxDiffPixelRatio: 0.02,
        animations: "disabled",
        timeout: 20_000,
      });
    });
  }
});
