import { defineConfig, devices } from "@playwright/test";

/* Visual & i18n layout suite (P1-UI-001): baseline-free layout assertions —
   no horizontal overflow, Hindi actually flips the document, the command
   palette journeys in a real browser. See tests/ui/visual-i18n.spec.ts for
   why these are layout facts instead of pixel-diff screenshots. */

/* ARCHITECH_DEMO_START_SIGNED_OUT makes a cookie-less visitor anonymous.
 *
 * Without it demo mode hands every visitor the broker-admin session
 * (src/lib/auth/live.ts), so `/login/` is already authenticated on arrival:
 * the screen's post-login effect calls `router.replace()` to /dashboard/
 * about 500ms in, and every pending Playwright action on the form then fails
 * with "element was detached from the DOM, retrying" until the timeout. The
 * three login tests can never touch the form, and it is not a selector or
 * animation problem — the page is navigating away underneath them.
 *
 * This is the same opt-in the Node end-to-end suites already use for exactly
 * this reason (tests/e2e/public-journeys.mjs, marketplace-flows.mjs,
 * broker-ops-flows.mjs), and it is what a real deployment does: a first-time
 * visitor is signed out. Set here rather than in the caller's shell so the
 * suite is self-contained. */
const SERVER_ENV = [
  "ARCHITECH_DEMO_START_SIGNED_OUT=true",
  "BETTER_AUTH_SECRET=devsecret123456789012345678901234567890",
  "BETTER_AUTH_URL=http://127.0.0.1:3000",
  "ARCHITECH_CONTACT_ENCRYPTION_KEY=BwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwc=",
].join(" ");
export default defineConfig({
  testDir: "./tests/e2e-ui",
  timeout: 45_000,
  expect: { timeout: 10_000 },
  retries: process.env.CI ? 1 : 0,
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
    command: `${SERVER_ENV} pnpm tsx tests/e2e-ui/fixtures/seed-techno-fixtures.ts && ${SERVER_ENV} pnpm build:ci && ${SERVER_ENV} pnpm start:next`,
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
