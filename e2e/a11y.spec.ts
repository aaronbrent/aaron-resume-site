import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

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
      // The content is server-rendered: every waypoint org is present pre-hydration.
      for (const org of ["SoFi", "Public.com", "Empirium", "NuvaLabs"]) {
        await expect(page.getByText(org).first()).toBeVisible();
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

  test("heading hierarchy: one h1, waypoint h2s in t/DOM order", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    const h2Texts = await page.locator("[data-waypoint] h2").allTextContents();
    expect(h2Texts).toEqual(["SoFi", "Public.com", "Empirium", "NuvaLabs"]);
  });

  test("waypoints are deep-linkable: /#nuvalabs scrolls to the section", async ({
    page,
  }) => {
    await page.goto("/#nuvalabs");
    const section = page.locator("#nuvalabs");
    await expect(section).toBeInViewport();
  });

  test("the closed trail is deep-linkable and remains part of the printed document", async ({
    page,
  }) => {
    await page.goto("/#closed-trail");
    await expect(page.locator("#closed-trail")).toBeInViewport();
    await page.emulateMedia({ media: "print" });
    await expect(page.locator("#closed-trail")).toBeVisible();
    await expect(page.locator("[data-print-hidden]").first()).toBeHidden();
  });

  test("the closed-trail postscript never overlaps the last waypoint card", async ({
    page,
  }) => {
    await page.goto("/");
    const last = await page.locator("section#nuvalabs").boundingBox();
    const closed = await page.locator("[data-closed-trail-card]").boundingBox();
    expect(last).not.toBeNull();
    expect(closed).not.toBeNull();
    // Desktop separates the two by column (x); mobile stacks them (y). Either
    // way their boxes must not intersect, or the semi-opaque card bleeds text.
    const intersects =
      last!.x < closed!.x + closed!.width &&
      closed!.x < last!.x + last!.width &&
      last!.y < closed!.y + closed!.height &&
      closed!.y < last!.y + last!.height;
    expect(intersects).toBe(false);
  });

  test("keyboard traversal reaches contact links in document order", async ({ page }) => {
    await page.goto("/");
    const hrefs: string[] = [];
    for (let i = 0; i < 25; i++) {
      await page.keyboard.press("Tab");
      const href = await page.evaluate(
        () => document.activeElement?.getAttribute("href") ?? null,
      );
      if (href) hrefs.push(href);
    }
    // Hero links come before base-camp contact links, which come before colophon.
    expect(hrefs[0]).toBe("#main");
    expect(hrefs).toContain("/resume");
    expect(hrefs).toContain("mailto:aaronbrentellis@gmail.com");
    const mailtoIndex = hrefs.indexOf("mailto:aaronbrentellis@gmail.com");
    expect(mailtoIndex).toBeGreaterThan(0);
  });

  test("resume PDF download link is present on both routes", async ({ page }) => {
    for (const path of ["/", "/resume"]) {
      await page.goto(path);
      await expect(
        page.locator('a[href="/aaron-ellis-resume.pdf"]').first(),
      ).toBeVisible();
    }
  });

  test("JSON-LD Person is embedded and parses", async ({ page }) => {
    await page.goto("/");
    const raw = await page.locator('script[type="application/ld+json"]').textContent();
    const parsed = JSON.parse(raw ?? "{}");
    expect(parsed["@type"]).toBe("Person");
    expect(parsed.name).toBe("Aaron Ellis");
  });

  test("social metadata uses the 1200×630 trail-map card", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
      "content",
      "https://aaronellis.dev/og-trail-map.png",
    );
    await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute(
      "content",
      "summary_large_image",
    );
  });
});
