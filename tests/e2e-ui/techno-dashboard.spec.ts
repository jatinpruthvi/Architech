import { test, expect, type Page } from "@playwright/test";
import { LoginPage } from "./pages/LoginPage";

async function ensureBrokerSession(page: Page) {
  await page.goto("/broker");
  if (!/\/login\/?/.test(page.url())) return;
  const login = new LoginPage(page);
  await login.clickDemoAccount(/Broker admin/i);
  await login.signInButton.click();
  await expect(page).toHaveURL(/\/broker\/?/, { timeout: 30_000 });
}

test.beforeEach(async ({ page }) => {
  await ensureBrokerSession(page);
});

test("techno dashboard renders KPI tiles and sidebar", async ({ page }) => {
  await page.goto("/broker");
  await expect(page.getByRole("heading", { name: /Owner Properties Data/ })).toBeVisible();
  await expect(page.getByText("Active Owner Properties")).toBeVisible();
  await expect(page.getByText("Added Today")).toBeVisible();
  await expect(page.getByText("Properties Status")).toBeVisible();
  // Sidebar nav shows Techno sections.
  await expect(page.getByRole("link", { name: "Dashboard" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Search" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Shortlisted" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Call queue/ })).toBeVisible();
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
    const callLink = page.getByRole("link", { name: /Call / }).first();
    await expect(callLink).toBeVisible();
    const callBox = await callLink.boundingBox();
    expect(callBox?.height).toBeGreaterThanOrEqual(44);

    const outcome = page.getByRole("button", { name: "Connected" }).first();
    const outcomeBox = await outcome.boundingBox();
    expect(outcomeBox?.height).toBeGreaterThanOrEqual(44);
  });
});
