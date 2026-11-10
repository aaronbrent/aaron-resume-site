import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const ORGS = ["SoFi", "Public.com", "Empirium", "NuvaLabs", "Topstep"];

for (const path of ["/", "/resume"]) {
  test.describe(`accessibility: ${path}`, () => {
    test("has zero axe violations", async ({ page }) => {
      await page.goto(path);
      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations).toEqual([]);
    });

    test("renders the full document without JavaScript", async ({ browser }) => {
      const context = await browser.newContext({ javaScriptEnabled: false });
      const page = await context.newPage();
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toContainText("Aaron Ellis");
      // Content is prerendered: every org is present pre-hydration.
      for (const org of ORGS) {
        await expect(page.getByText(org, { exact: false }).first()).toBeVisible();
      }
      await context.close();
    });
  });
}

test.describe("document structure", () => {
  test("skip link is the first focusable element and targets #main", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Tab");
    await expect(page.locator(":focus")).toHaveAttribute("href", "#main");
  });

  test("one h1; planet h2s in chronological order", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    const h2Texts = await page.locator("[data-planet] h2").allTextContents();
    expect(h2Texts).toEqual(ORGS);
  });

  test("planets are deep-linkable: /#topstep scrolls to the section", async ({
    page,
  }) => {
    await page.goto("/#topstep");
    await expect(page.locator("#topstep")).toBeInViewport();
  });

  test("Topstep shows its role subtitle and the NuvaLabs end date", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#topstep")).toContainText("Trading Platform — Charts");
    await expect(page.locator("#topstep")).toContainText("Oct 2026 — Present");
    await expect(page.locator("#nuvalabs")).toContainText("Jun 2024 — May 2026");
  });

  test("the 3D layer mount point is hidden from assistive tech", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("[data-scene-root]")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  });

  test("resume PDF download link is present on both routes", async ({ page }) => {
    for (const path of ["/", "/resume"]) {
      await page.goto(path);
      await expect(
        page.locator('a[href="/aaron-ellis-resume.pdf"]').first(),
      ).toBeVisible();
    }
  });

  test("resume PDF is served", async ({ request }) => {
    const res = await request.head("/aaron-ellis-resume.pdf");
    expect(res.status()).toBe(200);
  });

  test("/resume lists all five roles, most recent first", async ({ page }) => {
    await page.goto("/resume");
    const h3s = await page.locator("#experience-title ~ article h3").allTextContents();
    expect(h3s.map((t) => t.split(" — ").at(-1))).toEqual([...ORGS].reverse());
  });

  test("JSON-LD Person is embedded and parses", async ({ page }) => {
    await page.goto("/");
    const raw = await page.locator('script[type="application/ld+json"]').textContent();
    const parsed = JSON.parse(raw ?? "{}");
    expect(parsed["@type"]).toBe("Person");
    expect(parsed.name).toBe("Aaron Ellis");
  });
});

test.describe("hero readability", () => {
  // axe can't judge text over images or canvas (it reports "incomplete"),
  // so assert the structure that guarantees contrast instead: every piece
  // of hero text sits on the opaque plate, whatever is drawn behind it.
  for (const reducedMotion of ["no-preference", "reduce"] as const) {
    test(`hero text sits on an opaque plate (${reducedMotion} motion)`, async ({
      page,
    }) => {
      await page.emulateMedia({ reducedMotion });
      await page.goto("/");
      const plate = page.locator("[data-hero-plate]");
      // Tailwind v4 computes bg-void/80 as e.g. "oklab(… / 0.8)" or "rgba(…, 0.8)".
      const alpha = await plate.evaluate((el) => {
        const bg = getComputedStyle(el).backgroundColor;
        const slash = /\/\s*([\d.]+)%?\s*\)$/.exec(bg);
        if (slash) return Number(slash[1]);
        const rgba = /^rgba\([^,]+,[^,]+,[^,]+,\s*([\d.]+)\)$/.exec(bg);
        if (rgba) return Number(rgba[1]);
        return /^(rgb|oklab|oklch|color)\(/.test(bg) ? 1 : 0;
      });
      expect(alpha).toBeGreaterThanOrEqual(0.8);
      const box = (await plate.boundingBox())!;
      for (const el of await page.locator("#main > header :is(h1, p)").all()) {
        const b = (await el.boundingBox())!;
        expect(b.x).toBeGreaterThanOrEqual(box.x - 0.5);
        expect(b.y).toBeGreaterThanOrEqual(box.y - 0.5);
        expect(b.x + b.width).toBeLessThanOrEqual(box.x + box.width + 0.5);
        expect(b.y + b.height).toBeLessThanOrEqual(box.y + box.height + 0.5);
      }
    });
  }

  test("unknown paths render the 404 page", async ({ page }) => {
    await page.goto("/no-such-page");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("404");
    await expect(page).toHaveTitle(/Not found/);
  });
});
