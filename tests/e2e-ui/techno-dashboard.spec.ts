import { test, expect, type Page } from "@playwright/test";

async function ensureBrokerSession(page: Page) {
  /* Authenticate through the real route while keeping workspace journeys
     independent from login-screen animation and post-login routing. The
     request context shares its cookie jar with `page`. */
  const response = await page.request.post("/api/auth/login/", {
    headers: { Origin: "http://127.0.0.1:3000" },
    data: { phone: "+919876543210", password: "demo-broker-1234" },
  });
  expect(response.ok()).toBeTruthy();
  const payload = await response.json() as { session?: { user?: { role?: string } } };
  expect(payload.session?.user?.role).toBe("BROKER_ADMIN");

  await page.goto("/broker");
  await expect(page).toHaveURL(/\/broker\/?$/, { timeout: 30_000 });
}

test.beforeEach(async ({ page }) => {
  await ensureBrokerSession(page);
});

test("techno dashboard renders KPI tiles and responsive navigation", async ({ page }, testInfo) => {
  await page.goto("/broker");
  const main = page.locator("#techno-main");
  await expect(main.getByRole("heading", { name: /Owner Properties Data/ })).toBeVisible();
  await expect(main.getByText("Active Owner Properties", { exact: true })).toBeVisible();
  await expect(main.getByText("Added Today", { exact: true })).toBeVisible();
  await expect(main.getByText("Properties Status", { exact: true })).toBeVisible();

  if (testInfo.project.use.isMobile) {
    const navigation = page.getByRole("navigation", { name: "Broker mobile navigation" });
    await expect(navigation.getByRole("link", { name: "Home", exact: true })).toBeVisible();
    await expect(navigation.getByRole("link", { name: "Search", exact: true })).toBeVisible();
    await expect(navigation.getByRole("link", { name: "Calls", exact: true })).toBeVisible();
    await expect(navigation.getByRole("link", { name: "Saved", exact: true })).toBeVisible();
  } else {
    const navigation = page.getByRole("navigation", { name: "Broker workspace" });
    await expect(navigation.getByRole("link", { name: "Dashboard", exact: true })).toBeVisible();
    await expect(navigation.getByRole("link", { name: "Search", exact: true })).toBeVisible();
    await expect(navigation.getByRole("link", { name: "Shortlisted", exact: true })).toBeVisible();
    await expect(navigation.getByRole("link", { name: "Call queue", exact: true })).toBeVisible();
  }
});

test("owner properties table renders the expected columns", async ({ page }, testInfo) => {
  test.skip(Boolean(testInfo.project.use.isMobile), "Desktop table contract");
  await page.goto("/broker/owners/ResidentialRent");
  await expect(page.getByRole("columnheader", { name: "Action" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Property Type" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Date" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: /Name & Contact/ })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Address" })).toBeVisible();
  // At least one data row rendered (in addition to the table header).
  await expect.poll(() => page.getByRole("row").count()).toBeGreaterThan(1);
});

test.describe("mobile broker workspace", () => {
  test.use({
    viewport: { width: 393, height: 851 },
    hasTouch: true,
    isMobile: true,
  });

  test("uses focused app navigation without public-site chrome", async ({ page }) => {
    await page.goto("/broker");

    await expect(page.getByRole("banner", { name: "Broker workspace header" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Broker mobile navigation" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Explore" })).toHaveCount(0);
    await expect(page.getByRole("contentinfo")).toHaveCount(0);

    await page.getByRole("button", { name: "Open broker menu" }).click();
    const menu = page.getByRole("dialog", { name: "Broker workspace" });
    await expect(menu).toBeVisible();
    await expect(menu.getByRole("button", { name: "Owner Properties" })).toHaveAttribute("aria-expanded", "true");
    await menu.getByRole("link", { name: "Residential Rent" }).first().click();
    await expect(page).toHaveURL(/\/broker\/owners\/ResidentialRent/);
  });

  test("defaults owner inventory to cards and lets the user switch to the table", async ({ page }) => {
    await page.goto("/broker/owners/ResidentialRent");

    await expect(page.getByRole("button", { name: "Card view" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("region", { name: "Property cards" })).toBeVisible();
    await expect(page.getByRole("article", { name: /property/i }).first()).toBeVisible();

    await page.getByRole("button", { name: "Table view" }).click();
    await expect(page.getByRole("button", { name: "Table view" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("table")).toBeVisible();

    const hasPageOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(hasPageOverflow).toBe(false);
  });

  test("keeps filters active while paging through owner inventory", async ({ page }) => {
    await page.goto("/broker/owners/ResidentialRent?premium=1");

    await expect(page.getByRole("button", { name: /Premium only/ })).toBeVisible();
    await page.getByRole("link", { name: "Next page" }).first().click();
    await expect(page).toHaveURL(/premium=1/);
    await expect(page).toHaveURL(/page=2/);
  });

  test("keeps the daily calling workflow thumb-friendly", async ({ page }) => {
    await page.goto("/broker/call-queue");

    await expect(page.getByRole("heading", { name: /Today’s call queue/i })).toBeVisible();
    const callLink = page.locator('a[data-tp-action="call"]').first();
    await expect(callLink).toBeVisible();
    const callBox = await callLink.boundingBox();
    /* Chromium can report a CSS 44px box as 43.999999px after device-scale
       conversion, so retain a sub-pixel tolerance without weakening the target. */
    expect(callBox?.height).toBeGreaterThanOrEqual(43.5);

    const outcome = page.getByRole("button", { name: "Connected" }).first();
    const outcomeBox = await outcome.boundingBox();
    expect(outcomeBox?.height).toBeGreaterThanOrEqual(43.5);
  });
});
