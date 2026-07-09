import { expect, test } from "@playwright/test";

test.describe("the rider is alive (Phase 4)", () => {
  test("mounts a pooled spray canvas and writes continuous motion channels", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.locator("[data-spray]")).toBeAttached();
    const height = await page.evaluate(
      () => document.querySelector<HTMLElement>(".run-container")!.offsetHeight,
    );
    await page.evaluate((y) => window.scrollTo(0, y), height * 0.32);
    await page.waitForTimeout(700);
    const state = await page.evaluate(() => {
      const rider = document.querySelector<HTMLElement>("[data-rider]")!;
      return {
        pose: rider.dataset.pose,
        lean: rider.style.getPropertyValue("--lean"),
        crouch: rider.style.getPropertyValue("--crouch"),
      };
    });
    expect(state.pose).toMatch(/^(carve-left|carve-right|compress|unweight|tuck)$/);
    expect(state.lean).toMatch(/deg$/);
    expect(state.crouch).not.toBe("");
  });

  test("switches stance only after sustained reverse scroll", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => window.scrollTo(0, 4200));
    await page.waitForTimeout(700);
    await page.evaluate(() => window.scrollTo(0, 300));
    await expect
      .poll(() => page.locator("[data-rider]").getAttribute("data-pose"), {
        timeout: 1500,
      })
      .toBe("switch");
  });

  test("gondola credits resolve on scroll", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".gondola-credits li")).toHaveCount(3);
    await page.evaluate(() => window.scrollTo(0, 80));
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.classList.contains("has-scrolled")),
      )
      .toBe(true);
    await expect(page.locator(".gondola-credits li").first()).toHaveCSS("opacity", "1");
  });

  test("reduced motion mounts neither the rig spray nor gondola animation", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await expect(page.locator("[data-spray]")).toHaveCount(0);
    await expect(page.locator(".gondola-cabin")).toHaveCSS("animation-name", "none");
  });
});
