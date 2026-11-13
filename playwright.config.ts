import { defineConfig, devices } from "@playwright/test";

// End-to-end tests.
//  - CI: runs against the production build (`next start`) with the bundled sample data.
//  - After a deploy: BASE_URL=https://… runs only the @smoke tests against the live site.
//  - Locally: CHROME_PATH=/usr/bin/google-chrome npm run test:e2e (after `npm run build`).
const BASE_URL = process.env.BASE_URL;
const PORT = 3100;

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 45_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: BASE_URL ?? `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    // Vercel preview deployments with Deployment Protection
    extraHTTPHeaders: process.env.VERCEL_AUTOMATION_BYPASS_SECRET
      ? { "x-vercel-protection-bypass": process.env.VERCEL_AUTOMATION_BYPASS_SECRET }
      : undefined,
    launchOptions: {
      executablePath: process.env.CHROME_PATH || undefined,
      // WebGL in headless Chrome without a GPU
      args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
    },
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    { name: "mobile", use: { ...devices["Pixel 7"] }, grep: /@mobile/ },
  ],
  webServer: BASE_URL
    ? undefined
    : {
        command: `npm run start -- -p ${PORT}`,
        url: `http://localhost:${PORT}`,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        // force the bundled sample data so tests are deterministic and need no secrets
        env: { SUPABASE_URL: "", SUPABASE_PUBLISHABLE_KEY: "" },
      },
});
