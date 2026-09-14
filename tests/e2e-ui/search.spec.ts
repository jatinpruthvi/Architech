import { test, expect } from "@playwright/test";
import { SearchPage } from "./pages/SearchPage";

test.describe("Search Results Journey", () => {
  test("displays search results deterministically", async ({ page }) => {
    const searchPage = new SearchPage(page);

    await searchPage.goto("mumbai");

    await expect(searchPage.titleHeading).toContainText(/Mumbai/i);

    if (await searchPage.filtersButton.isVisible()) {
      await searchPage.filtersButton.click();
    }

    // Since we are unmocked, the page must show at least one property for 'mumbai'.
    await expect(searchPage.propertyCards.first()).toBeVisible({ timeout: 10000 });
  });

  test("displays zero results state deterministically", async ({ page }) => {
    const searchPage = new SearchPage(page);

    // Provide a query that guarantees zero matches from fixtures
    await searchPage.goto("xxyyzz_no_match");

    // Explicitly verify the zero state is visible
    await expect(searchPage.noResultsMessage).toBeVisible({ timeout: 10000 });
  });
});
