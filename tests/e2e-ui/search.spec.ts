import { test, expect } from "@playwright/test";
import { SearchPage } from "./pages/SearchPage";

test.describe("Search Results Journey", () => {
  test("displays search results deterministically", async ({ page }) => {
    const searchPage = new SearchPage(page);

    // Mock search API to return a predictable property card result
    await page.route("**/api/search*", async (route) => {
      const json = {
        query: "bangalore",
        city: "bangalore",
        pincode: null,
        filters: [],
        category: "residential",
        intent: "buy",
        sort: "relevance",
        count: 1,
        source: "fixture-repository",
        indexPlan: "postgres-fts-trigram-ready",
        page: { limit: 48, offset: 0, hasMore: false },
        results: [
          { 
            id: "mock-1", 
            title: "Mock Villa", 
            price: "₹2 Cr", 
            priceNum: 20000000,
            locality: "Test Area",
            city: "Bangalore",
            badge: "RERA Verified",
            details: { bathrooms: 2, parkingSpaces: 1 }
          }
        ],
        projection: "consumer",
        facets: {},
        applied: [],
        relaxations: [],
        widening: []
      };
      await route.fulfill({ json });
    });

    await searchPage.goto("bangalore");

    await expect(searchPage.titleHeading).toContainText(/Bangalore/i);

    if (await searchPage.filtersButton.isVisible()) {
      await searchPage.filtersButton.click();
    }

    // Verify that the mocked result is correctly rendered as a property card
    await expect(searchPage.propertyCards.first()).toBeVisible();
    await expect(page.getByText("Mock Villa")).toBeVisible();
  });

  test("displays zero results state deterministically", async ({ page }) => {
    const searchPage = new SearchPage(page);

    // Mock search API to return zero results
    await page.route("**/api/search*", async (route) => {
      const json = {
        query: "nowhere",
        city: "all",
        pincode: null,
        filters: [],
        category: "residential",
        intent: "buy",
        sort: "relevance",
        count: 0,
        source: "fixture-repository",
        indexPlan: "postgres-fts-trigram-ready",
        page: { limit: 48, offset: 0, hasMore: false },
        results: [],
        projection: "consumer",
        facets: {},
        applied: [],
        relaxations: [],
        widening: []
      };
      await route.fulfill({ json });
    });

    await searchPage.goto("nowhere");
    
    // Explicitly verify the zero state is visible
    await expect(searchPage.noResultsMessage).toBeVisible();
  });
});
