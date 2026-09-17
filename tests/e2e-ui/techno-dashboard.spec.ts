import { test, expect } from "@playwright/test";

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

test("owner properties table renders the expected columns", async ({ page }) => {
  await page.goto("/broker/owners/ResidentialRent");
  await expect(page.getByRole("columnheader", { name: "Action" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Property Type" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Date" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: /Name & Contact/ })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Address" })).toBeVisible();
  // At least one row rendered (from demo seed)
  await expect(page.getByRole("row")).toHaveCountGreaterThan(1);
});
