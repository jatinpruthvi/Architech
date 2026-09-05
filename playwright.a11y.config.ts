import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/a11y",
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  /* "github" annotates failing assertions on the check run so CI failures are
     debuggable without downloading logs; "list" stays for the job stream. */
  reporter: [["list"], ["github"]],
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "retain-on-failure",
  },
  webServer: {
    /* Canonical Next runtime (start:next), matching the broker a11y suite:
       behavior suites exercise hydrated pages and API-backed surfaces that
       the static publish snapshot cannot serve. The snapshot itself keeps
       its own gates (SEO smoke, crawl simulation). */
    command: "pnpm build:ci && pnpm start:next",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    stdout: "pipe",
    stderr: "pipe",
  },
  projects: [
    {
      name: "chromium-desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1366, height: 900 } },
    },
    {
      name: "chromium-mobile",
      use: { ...devices["Pixel 5"] },
    },
  ],
});
