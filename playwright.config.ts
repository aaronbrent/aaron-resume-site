import { defineConfig, devices } from "@playwright/test";

// Sandboxed/CI-like environments can point at a system Chromium instead of a
// Playwright-managed download (e.g. PLAYWRIGHT_CHROMIUM_EXECUTABLE=/opt/pw-browsers/chromium).
const chromiumExecutable = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;
// Recent Chromium only falls back to SwiftShader WebGL (headless, no GPU)
// when explicitly allowed; the scene and visual specs need it.
const launchOptions = {
  args: ["--enable-unsafe-swiftshader"],
  ...(chromiumExecutable ? { executablePath: chromiumExecutable } : {}),
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
  // Linux-only baselines (docs/PLAN-STAR-SYSTEM.md §7); one folder per spec.
  snapshotPathTemplate:
    "{testDir}/__screenshots__/{testFilePath}/{projectName}/{arg}-{platform}{ext}",
  // Scene specs run on software GL: under CPU contention (parallel workers,
  // small CI runners) a scroll's re-render can block the page for seconds.
  expect: { timeout: 15_000, toHaveScreenshot: { maxDiffPixelRatio: 0.02 } },
  // CI installs Chromium only, so the phone project runs an iPhone viewport
  // on Chromium rather than WebKit.
  projects: [
    {
      name: "desktop-chromium",
      use: { ...devices["Desktop Chrome"], launchOptions },
    },
    {
      name: "mobile",
      use: { ...devices["iPhone 13"], defaultBrowserType: "chromium", launchOptions },
    },
  ],
  webServer: {
    command: "pnpm preview",
    url: "http://localhost:4173",
    reuseExistingServer: !process.env.CI,
  },
});
