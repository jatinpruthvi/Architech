import { defineConfig, devices } from "@playwright/test";

/* Visual & i18n layout suite (P1-UI-001): baseline-free layout assertions —
   no horizontal overflow, Hindi actually flips the document, the command
   palette journeys in a real browser. See tests/ui/visual-i18n.spec.ts for
   why these are layout facts instead of pixel-diff screenshots. */
export default defineConfig({
  testDir: "./tests/ui",
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
    /* Run against the canonical Next runtime, not the static publish snapshot:
       palette journeys need /api/search/suggest, which only the runtime
       serves. Same choice as playwright.a11y.broker.config.ts. */
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
