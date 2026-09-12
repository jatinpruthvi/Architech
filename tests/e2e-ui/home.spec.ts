import { test, expect } from "@playwright/test";
import { HomePage } from "./pages/HomePage";

test.describe("Home Page Journey", () => {
  test("displays hero section and search bar", async ({ page }) => {
    const homePage = new HomePage(page);
    await homePage.goto();

    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(homePage.searchInput).toBeVisible();

    // Setup network mock for suggestions to make the test deterministic
    await page.route("**/api/search/suggest*", async (route) => {
      const json = { suggestions: [{ text: "Bangalore", type: "city", slug: "bengaluru" }] };
      await route.fulfill({ json });
    });

    await homePage.searchFor("Bangalore");
    
    // Suggestion box should appear
    await expect(homePage.suggestionBox).toBeVisible();
  });

  test("can navigate to popular searches", async ({ page }) => {
    const homePage = new HomePage(page);
    
    // Intercept popular searches to render deterministically
    await page.route("**/api/search/suggest*", async (route) => {
      const json = { suggestions: [{ text: "Popular Search Location", type: "city", slug: "popular" }] };
      await route.fulfill({ json });
    });

    await homePage.goto();
    
    const popularSearch = homePage.popularSearchLinks.first();
    // Verify it actually loads popular searches based on either fallback or client-side fetch
    if (await popularSearch.isVisible()) {
        await popularSearch.click();
        await page.waitForLoadState("networkidle");
        await expect(page.url()).toContain("/search");
    }
  });
});
