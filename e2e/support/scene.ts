import { expect, type Page } from "@playwright/test";

/** Headless Chromium is SwiftShader; ?gl=full lets the probe accept it. */
export const SCENE_URL = "/?gl=full";
/** Deterministic: pinned pose/tier, frozen clocks (docs/PLAN-STAR-SYSTEM.md §7). */
export const QA_URL = "/?gl=full&qa=1";

export const PLANETS = [
  {
    id: "sofi",
    org: "SoFi",
    role: "Frontend Engineer, SoFi Invest",
    period: "Jun 2017 — Mar 2021",
  },
  {
    id: "public",
    org: "Public.com",
    role: "Senior Software Engineer",
    period: "Apr 2021 — May 2023",
  },
  {
    id: "empirium",
    org: "Empirium",
    role: "Full-Stack Engineer (Contract)",
    period: "Jun 2023 — May 2024",
  },
  {
    id: "nuvalabs",
    org: "NuvaLabs",
    role: "Staff Software Engineer",
    period: "Jun 2024 — May 2026",
  },
  {
    id: "topstep",
    org: "Topstep",
    role: "Staff Software Engineer",
    period: "Oct 2026 — Present",
  },
] as const;

export async function waitForScene(page: Page) {
  await expect(page.locator("[data-scene-root] canvas")).toHaveCount(1, {
    timeout: 20_000,
  });
  await expect(page.locator("html")).toHaveAttribute("data-scene", "on", {
    timeout: 20_000,
  });
}

/**
 * Parks at stop `k` (0 = hero, i + 1 = planet i): its section top at the
 * viewport top, exactly where app/lib/progress.ts puts the stop. Fractional
 * `k` scrolls proportionally between two stops (mid-flight).
 */
export async function parkAtStop(page: Page, k: number) {
  await page.evaluate((k) => {
    const els = document.querySelectorAll<HTMLElement>(
      "#main > header, #main > [data-planet]",
    );
    const tops = Array.from(els, (el, i) =>
      i === 0 ? 0 : el.getBoundingClientRect().top + window.scrollY,
    );
    const whole = Math.floor(k);
    const f = k - whole;
    if (tops[whole] === undefined || (f > 0 && tops[whole + 1] === undefined)) {
      throw new Error(`no stop ${k}`);
    }
    const top =
      f === 0 ? tops[whole]! : tops[whole]! + (tops[whole + 1]! - tops[whole]!) * f;
    window.scrollTo({ top, behavior: "instant" });
  }, k);
  // progress.ts publishes on the next animation frame.
  await page.evaluate(
    () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
  );
}

/** Console noise that is the headless GPU, not the app. */
export function isDriverNoise(text: string): boolean {
  return /GPU stall due to ReadPixels|GL Driver Message/.test(text);
}
