import { defineConfig, devices } from "@playwright/test";

// Sandboxed/CI-like environments can point at a system Chromium instead of a
// Playwright-managed download (e.g. PLAYWRIGHT_CHROMIUM_EXECUTABLE=/opt/pw-browsers/chromium).
const chromiumExecutable = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;
const launchOptions = chromiumExecutable
  ? { executablePath: chromiumExecutable }
  : undefined;

// The v1 suites describe Tier 1 (PLAN-3D ADR-6) and stay green as the net:
// they run with the map preference pre-seeded through the same localStorage
// key the legend toggle writes. The dropin project covers Tier 2.
const tier1Storage = {
  cookies: [],
  origins: [
    {
      origin: "http://localhost:4173",
      localStorage: [{ name: "aaronellis:tier", value: "map" }],
    },
  ],
};

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://localhost:4173",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "desktop-chromium",
      use: { ...devices["Desktop Chrome"], launchOptions, storageState: tier1Storage },
      testIgnore: /dropin\.spec\.ts/,
    },
    {
      name: "mobile-chromium",
      use: { ...devices["Pixel 7"], launchOptions, storageState: tier1Storage },
      testIgnore: /dropin\.spec\.ts/,
    },
    {
      name: "dropin-chromium",
      use: { ...devices["Desktop Chrome"], launchOptions },
      testMatch: /dropin\.spec\.ts/,
    },
  ],
  webServer: {
    command: "pnpm preview",
    url: "http://localhost:4173",
    reuseExistingServer: !process.env.CI,
  },
});
