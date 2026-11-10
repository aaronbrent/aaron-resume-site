import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { PLANETS, parkAtStop, QA_URL, SCENE_URL, waitForScene } from "./support/scene";

// ?qa=1 renders on demand: the flight logic, fades and keyboard are the same,
// but headless software GL isn't pegging the CPU while we assert on the DOM.
const FLIGHT_URL = QA_URL;

test.describe("flight through the system (scene on)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(FLIGHT_URL);
    await waitForScene(page);
  });

  test("each planet's role and period are shown when the camera parks there", async ({
    page,
  }) => {
    // Five parks, each re-rendering a few software-GL frames.
    test.setTimeout(90_000);
    for (const [i, planet] of PLANETS.entries()) {
      await parkAtStop(page, i + 1);
      const card = page.locator(`#${planet.id} > article`);
      await expect(card).toBeInViewport();
      await expect(card.getByRole("heading", { level: 2 })).toHaveText(planet.org);
      await expect(card).toContainText(planet.role);
      await expect(card).toContainText(planet.period);
      // The panel is fully revealed at its stop…
      await expect
        .poll(() => card.evaluate((el) => Number(getComputedStyle(el).opacity)))
        .toBeGreaterThan(0.99);
      // …and its neighbours are faded out.
      for (const other of PLANETS.filter((p) => p.id !== planet.id)) {
        const o = await page
          .locator(`#${other.id} > article`)
          .evaluate((el) => Number(getComputedStyle(el).opacity));
        expect(o, `${other.id} while parked at ${planet.id}`).toBeLessThan(0.01);
      }
    }
  });

  test("the hero fades as the camera leaves the sun, and returns", async ({ page }) => {
    // The fade applies to the hero plate (opacity isn't inherited, so read it there).
    const plate = page.locator("[data-hero-plate]");
    const opacity = () => plate.evaluate((el) => Number(getComputedStyle(el).opacity));
    await expect.poll(opacity).toBeGreaterThan(0.99);
    await parkAtStop(page, 1);
    await expect.poll(opacity).toBeLessThan(0.01);
    await parkAtStop(page, 0);
    await expect.poll(opacity).toBeGreaterThan(0.99);
  });

  test("keyboard: ArrowDown steps planet by planet, End/Home jump", async ({
    page,
    isMobile,
  }) => {
    // Phone panels are taller than the screen: arrows scroll natively there.
    test.skip(isMobile, "stepping only applies when a step fits in one viewport");
    await page.locator("body").click({ position: { x: 5, y: 5 } });
    for (const planet of PLANETS.slice(0, 3)) {
      await page.keyboard.press("ArrowDown");
      await expect(page.locator(`#${planet.id}`)).toBeInViewport({ ratio: 0.9 });
    }
    await page.keyboard.press("End");
    await expect(page.locator("#topstep")).toBeInViewport({ ratio: 0.9 });
    await page.keyboard.press("Home");
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  });

  test("keyboard: the footer stays reachable; ArrowUp returns to the last planet", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "desktop keyboard behaviour");
    await page.locator("body").click({ position: { x: 5, y: 5 } });
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const bottom = await page.evaluate(() => window.scrollY);
    await page.keyboard.press("ArrowDown");
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThanOrEqual(bottom - 1);
    await expect(page.getByRole("heading", { name: "Contact" })).toBeInViewport();
    await page.keyboard.press("ArrowUp");
    await expect(page.locator("#topstep")).toBeInViewport({ ratio: 0.9 });
  });

  test("deep links reveal the right panel without a scroll", async ({ page }) => {
    // A fresh load (not a same-document hash change): the browser restores
    // the anchor before the app attaches its scroll listener.
    await page.goto("about:blank");
    await page.goto(`${FLIGHT_URL}#topstep`);
    await waitForScene(page);
    const opacity = (id: string) =>
      page
        .locator(`#${id} > article`)
        .evaluate((el) => Number(getComputedStyle(el).opacity));
    await expect.poll(() => opacity("topstep")).toBeGreaterThan(0.99);
    await expect.poll(() => opacity("sofi")).toBeLessThan(0.01);
  });

  test("focused content is never faded out", async ({ page, isMobile }) => {
    test.skip(isMobile, "keyboard focus traversal is a desktop concern");
    await parkAtStop(page, 3);
    // Tab back up into the hero's links while parked far away.
    await page.locator('#main > header a[href="/resume"]').focus();
    await expect
      .poll(() =>
        page.locator('#main > header a[href="/resume"]').evaluate((el) => {
          return Number(getComputedStyle(el.closest("[data-hero-plate]")!).opacity);
        }),
      )
      .toBeGreaterThan(0.99);
  });

  test("has zero axe violations parked at the outermost planet", async ({ page }) => {
    await parkAtStop(page, PLANETS.length);
    await expect
      .poll(() =>
        page
          .locator("#topstep > article")
          .evaluate((el) => Number(getComputedStyle(el).opacity)),
      )
      .toBeGreaterThan(0.99);
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
});

test.describe("reduced motion: the stacked document", () => {
  test.use({ colorScheme: "dark" });

  test("no canvas, every card visible, poster backdrop, tab order intact", async ({
    page,
    isMobile,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(SCENE_URL);
    await expect(page.locator("html")).toHaveAttribute("data-scene", "off");
    await expect(page.locator("canvas")).toHaveCount(0);
    for (const planet of PLANETS) {
      const card = page.locator(`#${planet.id} > article`);
      await card.scrollIntoViewIfNeeded();
      await expect(card).toBeVisible();
      expect(await card.evaluate((el) => Number(getComputedStyle(el).opacity))).toBe(1);
    }
    const backdrop = await page
      .locator("[data-scene-root]")
      .evaluate((el) => getComputedStyle(el).backgroundImage);
    expect(backdrop).toContain("/poster/");

    if (isMobile) return;
    await page.evaluate(() => window.scrollTo(0, 0));
    const hrefs: string[] = [];
    for (let i = 0; i < 9; i++) {
      await page.keyboard.press("Tab");
      hrefs.push(
        await page.evaluate(() => document.activeElement?.getAttribute("href") ?? ""),
      );
    }
    expect(hrefs.slice(0, 3)).toEqual(["#main", "/resume", "/aaron-ellis-resume.pdf"]);
    expect(hrefs).toContain("mailto:aaronbrentellis@gmail.com");
  });
});

test.describe("social card", () => {
  test("og:image points at the rendered poster card, which is served", async ({
    page,
    request,
  }) => {
    await page.goto("/");
    const og = await page.locator('meta[property="og:image"]').getAttribute("content");
    expect(og).toMatch(/\/poster\/og\.jpg$/);
    await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute(
      "content",
      "summary_large_image",
    );
    const res = await request.get("/poster/og.jpg");
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("image/jpeg");
  });
});

test.describe("role cards float beside their planets", () => {
  test("desktop: each card is fixed beside its planet, inside the viewport, never over it", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "phones keep the card in flow below the planet");
    test.setTimeout(90_000);
    await page.goto(QA_URL);
    await waitForScene(page);
    const vp = page.viewportSize()!;
    for (const [i, planet] of PLANETS.entries()) {
      await parkAtStop(page, i + 1);
      const card = page.locator(`#${planet.id} > article`);
      await expect
        .poll(() => card.evaluate((el) => getComputedStyle(el).position))
        .toBe("fixed");
      await expect
        .poll(() => card.evaluate((el) => el.style.getPropertyValue("--planet-r")))
        .not.toBe("");
      const geo = await card.evaluate((el) => {
        const r = el.getBoundingClientRect();
        const n = (p: string) => parseFloat(el.style.getPropertyValue(p));
        return {
          box: { x: r.x, y: r.y, w: r.width, h: r.height },
          planet: { x: n("--planet-x"), y: n("--planet-y"), r: n("--planet-r") },
          connector: parseFloat(getComputedStyle(el, "::after").width),
        };
      });
      // Inside the viewport.
      expect(geo.box.x).toBeGreaterThanOrEqual(0);
      expect(geo.box.y).toBeGreaterThanOrEqual(0);
      expect(geo.box.x + geo.box.w).toBeLessThanOrEqual(vp.width);
      expect(geo.box.y + geo.box.h).toBeLessThanOrEqual(vp.height);
      // Beside the planet, not over its disc.
      const nx = Math.min(Math.max(geo.planet.x, geo.box.x), geo.box.x + geo.box.w);
      const ny = Math.min(Math.max(geo.planet.y, geo.box.y), geo.box.y + geo.box.h);
      const dist = Math.hypot(geo.planet.x - nx, geo.planet.y - ny);
      expect(dist, `${planet.id} card overlaps its planet`).toBeGreaterThanOrEqual(
        geo.planet.r - 1,
      );
      // The planet itself is on screen, and a connector reaches toward it.
      expect(geo.planet.x).toBeGreaterThan(0);
      expect(geo.planet.x).toBeLessThan(vp.width);
      expect(geo.connector).toBeGreaterThan(0);
    }
  });

  test("phones: the card stays in the document flow below the planet", async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, "phone layout");
    await page.goto(QA_URL);
    await waitForScene(page);
    await parkAtStop(page, 2);
    const card = page.locator("#public > article");
    expect(await card.evaluate((el) => getComputedStyle(el).position)).toBe("static");
    const top = await card.evaluate((el) => el.getBoundingClientRect().top);
    expect(top).toBeGreaterThan(page.viewportSize()!.height * 0.3);
  });
});
