import { expect, test } from "@playwright/test";

async function riderTransform(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const el = document.querySelector<HTMLElement>("[data-rider]");
    const m = el?.style.transform.match(
      /translate3d\(([-\d.]+)px, ([-\d.]+)px, 0px?\) rotate\(([-\d.]+)deg\)/,
    );
    return m ? { x: Number(m[1]), y: Number(m[2]), deg: Number(m[3]) } : null;
  });
}

test.describe("the rig (Phase 3)", () => {
  test("rider holds the screen band: transform y = scrollY + 38% viewport", async ({
    page,
  }) => {
    await page.goto("/");
    await page.evaluate(() => window.scrollTo(0, 2000));
    await page.waitForTimeout(900); // let the smoother settle + park
    const tf = await riderTransform(page);
    expect(tf).not.toBeNull();
    const expected = await page.evaluate(
      () => window.scrollY + window.innerHeight * 0.38,
    );
    expect(Math.abs(tf!.y - expected)).toBeLessThan(2);
  });

  test("board angle follows the slope: rotation differs along the run", async ({
    page,
  }) => {
    await page.goto("/");
    const height = await page.evaluate(
      () => document.querySelector<HTMLElement>(".run-container")!.offsetHeight,
    );
    await page.evaluate((y) => window.scrollTo(0, y), height * 0.25);
    await page.waitForTimeout(900);
    const a = await riderTransform(page);
    await page.evaluate((y) => window.scrollTo(0, y), height * 0.33);
    await page.waitForTimeout(900);
    const b = await riderTransform(page);
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    expect(Math.abs(a!.deg - b!.deg)).toBeGreaterThan(3);
  });

  test("rig parks when settled: transform stops changing", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => window.scrollTo(0, 1500));
    await page.waitForTimeout(1200);
    const first = await riderTransform(page);
    await page.waitForTimeout(400);
    const second = await riderTransform(page);
    expect(first).toEqual(second);
  });

  test("deep-link entry places the rider correctly before scroll", async ({ page }) => {
    await page.goto("/#nuvalabs");
    await page.waitForTimeout(900);
    const tf = await riderTransform(page);
    const expected = await page.evaluate(
      () => window.scrollY + window.innerHeight * 0.38,
    );
    expect(tf).not.toBeNull();
    expect(Math.abs(tf!.y - expected)).toBeLessThan(2);
  });

  test("reduced motion: the rig never takes over, rider stays parked", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await page.evaluate(() => window.scrollTo(0, 2000));
    await page.waitForTimeout(500);
    const state = await page.evaluate(() => {
      const el = document.querySelector<HTMLElement>("[data-rider]")!;
      return { transform: el.style.transform, active: el.dataset.rigActive };
    });
    expect(state.transform).toBe("");
    expect(state.active).not.toBe("true");
    await expect(page.locator("[data-rider]")).toBeVisible();
  });

  test("rider transform y stays exact across breakpoint resize", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => window.scrollTo(0, 1200));
    await page.waitForTimeout(900);
    const vp = page.viewportSize()!;
    const crossed =
      vp.width >= 768
        ? { width: 500, height: vp.height }
        : { width: 1100, height: vp.height };
    await page.setViewportSize(crossed);
    await page.waitForTimeout(600);
    const tf = await riderTransform(page);
    const expected = await page.evaluate(
      () => window.scrollY + window.innerHeight * 0.38,
    );
    expect(tf).not.toBeNull();
    expect(Math.abs(tf!.y - expected)).toBeLessThan(3);
  });

  test("HUD appears behind ?hud=1 and shows telemetry", async ({ page }) => {
    await page.goto("/?hud=1");
    await page.evaluate(() => window.scrollTo(0, 800));
    await page.waitForTimeout(600);
    await expect(page.locator("#hud")).toBeVisible();
    await expect(page.locator('#hud [data-hud="t"]')).toContainText("t");
    // HUD never renders without the flag
    await page.goto("/");
    await expect(page.locator("#hud")).toHaveCount(0);
  });
});
