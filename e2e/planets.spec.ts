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
    isMobile,
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
      // …and, where cards are fixed (desktop), its neighbours are faded out.
      // Phone cards sit in normal flow and are never faded.
      if (isMobile) continue;
      for (const other of PLANETS.filter((p) => p.id !== planet.id)) {
        const o = await page
          .locator(`#${other.id} > article`)
          .evaluate((el) => Number(getComputedStyle(el).opacity));
        expect(o, `${other.id} while parked at ${planet.id}`).toBeLessThan(0.01);
      }
    }
  });

  test("the hero fades as the camera leaves the sun, and returns", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "phones keep everything in flow, unfaded");
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
    // Five smooth scrolls, each re-rendering software-GL frames.
    test.setTimeout(90_000);
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

  test("deep links reveal the right panel without a scroll", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "phones keep every card in flow, unfaded");
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

test.describe("role cards", () => {
  test("desktop: fixed to the left, shown on arrival, never over the planet", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "phones keep the card in flow below the planet");
    test.setTimeout(120_000);
    await page.goto(QA_URL);
    await waitForScene(page);
    const vp = page.viewportSize()!;
    const lefts: number[] = [];
    for (const [i, planet] of PLANETS.entries()) {
      const card = page.locator(`#${planet.id} > article`);
      const opacity = () => card.evaluate((el) => Number(getComputedStyle(el).opacity));

      // Mid-flight toward it: the card hasn't appeared yet.
      await parkAtStop(page, i + 0.5);
      await expect.poll(opacity).toBeLessThan(0.01);

      // Parked: fixed on the left, fully shown, inside the viewport.
      await parkAtStop(page, i + 1);
      await expect.poll(opacity).toBeGreaterThan(0.99);
      expect(await card.evaluate((el) => getComputedStyle(el).position)).toBe("fixed");
      await expect
        .poll(() => card.evaluate((el) => el.style.getPropertyValue("--planet-r")))
        .not.toBe("");
      const geo = await card.evaluate((el) => {
        const r = el.getBoundingClientRect();
        const n = (p: string) => parseFloat(el.style.getPropertyValue(p));
        return {
          box: { x: r.x, y: r.y, w: r.width, h: r.height },
          planet: { x: n("--planet-x"), y: n("--planet-y"), r: n("--planet-r") },
        };
      });
      lefts.push(Math.round(geo.box.x));
      expect(geo.box.x + geo.box.w).toBeLessThan(vp.width / 2 + 1);
      expect(geo.box.y).toBeGreaterThanOrEqual(0);
      expect(geo.box.y + geo.box.h).toBeLessThanOrEqual(vp.height);
      // The planet is on the right half, clear of the card's box.
      expect(geo.planet.x).toBeGreaterThan(vp.width / 2);
      const nx = Math.min(Math.max(geo.planet.x, geo.box.x), geo.box.x + geo.box.w);
      const ny = Math.min(Math.max(geo.planet.y, geo.box.y), geo.box.y + geo.box.h);
      expect(
        Math.hypot(geo.planet.x - nx, geo.planet.y - ny),
        `${planet.id} card overlaps its planet`,
      ).toBeGreaterThanOrEqual(geo.planet.r - 1);
    }
    // One fixed side: the same left edge for every planet.
    expect(new Set(lefts).size).toBe(1);
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

test.describe("review fixes (Codex)", () => {
  /** The element hit-tested at the centre of `selector`'s first match. */
  const hitAtCentre = (page: import("@playwright/test").Page, selector: string) =>
    page.evaluate((sel) => {
      const el = document.querySelector(sel)!;
      const r = el.getBoundingClientRect();
      const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return hit === el || el.contains(hit);
    }, selector);

  test("hidden fixed cards never block the hero links", async ({ page, isMobile }) => {
    test.skip(isMobile, "fixed cards are a desktop layout");
    await page.goto(QA_URL);
    await waitForScene(page);
    await parkAtStop(page, 0);
    for (const href of ["/resume", "/aaron-ellis-resume.pdf"]) {
      expect(await hitAtCentre(page, `#main > header a[href="${href}"]`), href).toBe(
        true,
      );
    }
    await page.locator('#main > header a[href="/resume"]').click();
    await expect(page).toHaveURL(/\/resume\/?$/);
  });

  test("the last card leaves before the contact footer", async ({ page, isMobile }) => {
    test.skip(isMobile, "fixed cards are a desktop layout");
    await page.goto(QA_URL);
    await waitForScene(page);
    await page.evaluate(() =>
      window.scrollTo({
        top: document.documentElement.scrollHeight,
        behavior: "instant",
      }),
    );
    const topstep = page.locator("#topstep > article");
    await expect
      .poll(() => topstep.evaluate((el) => Number(getComputedStyle(el).opacity)))
      .toBeLessThan(0.01);
    for (const sel of [
      'footer a[href^="mailto:"]',
      'footer a[href*="github.com"]',
      'footer a[href*="linkedin.com"]',
      'footer a[href="/resume"]',
    ]) {
      expect(await hitAtCentre(page, sel), sel).toBe(true);
    }
  });

  test("phone cards stay readable to the end of their text", async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, "phone layout");
    await page.goto(QA_URL);
    await waitForScene(page);
    // Scroll until SoFi's last line sits near the bottom of the screen —
    // well past the point where fixed cards would have faded.
    await page.evaluate(() => {
      const card = document.querySelector("#sofi > article")!;
      const bottom = card.getBoundingClientRect().bottom + window.scrollY;
      window.scrollTo({ top: bottom - window.innerHeight + 16, behavior: "instant" });
    });
    await page.waitForTimeout(500);
    const opacity = await page
      .locator("#sofi > article")
      .evaluate((el) => Number(getComputedStyle(el).opacity));
    expect(opacity).toBe(1);
  });

  test.describe("short landscape window (768×520)", () => {
    test.use({ viewport: { width: 768, height: 520 } });

    test("cards that can't fit fall back to normal flow", async ({ page, isMobile }) => {
      test.skip(isMobile, "landscape desktop window");
      test.setTimeout(90_000);
      await page.goto(QA_URL);
      await waitForScene(page);
      for (const [i, planet] of PLANETS.entries()) {
        await parkAtStop(page, i + 1);
        const card = page.locator(`#${planet.id} > article`);
        const state = await card.evaluate((el) => ({
          position: getComputedStyle(el).position,
          overflow: el.scrollHeight > el.clientHeight + 1,
          flow: document.documentElement.classList.contains("cards-flow"),
        }));
        // Either it fits as a fixed card, or every card is back in flow.
        if (state.position === "fixed") expect(state.overflow, planet.id).toBe(false);
        else expect(state.flow, planet.id).toBe(true);
      }
    });
  });

  test("printing after the scene loads shows every role, in flow", async ({ page }) => {
    await page.goto(QA_URL);
    await waitForScene(page);
    await parkAtStop(page, 3);
    await page.emulateMedia({ media: "print" });
    for (const planet of PLANETS) {
      const style = await page.locator(`#${planet.id} > article`).evaluate((el) => ({
        opacity: getComputedStyle(el).opacity,
        position: getComputedStyle(el).position,
      }));
      expect(style, planet.id).toEqual({ opacity: "1", position: "static" });
    }
  });
});
