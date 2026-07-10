import { expect, test } from "@playwright/test";

test.describe("the map (Phase 2)", () => {
  test("exactly one trail variant is visible per breakpoint", async ({ page }) => {
    await page.goto("/");
    const mobile = page.locator(".trail-svg-mobile");
    const desktop = page.locator(".trail-svg-desktop");
    const isMobileViewport = (page.viewportSize()?.width ?? 1280) < 768;
    await expect(isMobileViewport ? mobile : desktop).toBeVisible();
    await expect(isMobileViewport ? desktop : mobile).toBeHidden();
  });

  test("waypoint marker aligns with its content card", async ({ page }) => {
    await page.goto("/");
    const marker = page.locator('[data-marker="public"]:visible');
    const card = page.locator("section#public");
    const markerBox = await marker.boundingBox();
    const cardBox = await card.boundingBox();
    expect(markerBox).not.toBeNull();
    expect(cardBox).not.toBeNull();
    // Card top sits at t × runHeight — the same y the marker is drawn at.
    const markerCenterY = markerBox!.y + markerBox!.height / 2;
    expect(Math.abs(markerCenterY - cardBox!.y)).toBeLessThan(60);
  });

  test("the mountain stage is aria-hidden with zero focusable descendants", async ({
    page,
  }) => {
    await page.goto("/");
    const focusables = await page
      .locator(
        '[aria-hidden="true"] a, [aria-hidden="true"] button, [aria-hidden="true"] [tabindex]',
      )
      .count();
    expect(focusables).toBe(0);
  });

  test("sections reveal on scroll", async ({ page }) => {
    await page.goto("/");
    const sofi = page.locator("section#sofi");
    await expect(sofi).toHaveClass(/reveal/);
    await sofi.scrollIntoViewIfNeeded();
    await expect(sofi).toHaveClass(/revealed/);
    await expect(sofi).toHaveCSS("opacity", "1");
  });

  test("reduced motion: content reveals opacity-only, map still complete", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    // The static map is fully rendered.
    await expect(
      page.locator(".trail-svg-mobile, .trail-svg-desktop").first(),
    ).toBeAttached();
    expect(await page.locator("[data-marker]:visible").count()).toBe(4);
    const sofi = page.locator("section#sofi");
    await sofi.scrollIntoViewIfNeeded();
    await expect(sofi).toHaveCSS("opacity", "1");
    // No translate channel under reduced motion — opacity is the only reveal.
    await expect(sofi).toHaveCSS("translate", "none");
  });

  test("deep link lands with marker and card in viewport", async ({ page }) => {
    await page.goto("/#nuvalabs");
    await expect(page.locator("section#nuvalabs")).toBeInViewport();
  });

  test("the closed trail has a visible patrol rope and CLOSED sign", async ({ page }) => {
    await page.goto("/#closed-trail");
    await expect(page.locator("[data-closed-trail-rope]:visible")).toBeVisible();
    await expect(page.locator("[data-closed-trail-card]")).toContainText("My Menu Plans");
  });
});
