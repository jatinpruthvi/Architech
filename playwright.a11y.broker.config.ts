import { defineConfig, devices } from "@playwright/test";

/* Broker-route a11y (non-payment audit: "broker-route axe coverage remains a
   gap"). Kept apart from the public smoke config on purpose: that suite
   serves the static prerender (`pnpm start`), where the guarded desk routes
   don't exist. Broker routes need the Next runtime PLUS a session, so this
   server boots with the documented preview hatch — demo-contract sessions on
   a production build, the same path `tests/e2e/marketplace-flows.mjs` uses.
   Never set that var in a real deployment (see runtime-activation-gates.md). */
export default defineConfig({
  testDir: "./tests/a11y-broker",
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
    command: "pnpm build && ARCHITECH_ALLOW_DEMO_AUTH_IN_PRODUCTION=true pnpm start:next",
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
