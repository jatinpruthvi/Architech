import { test, expect } from "@playwright/test";
import { SearchPage } from "./pages/SearchPage";

test.describe("Search Results Journey", () => {
  test("displays search results deterministically", async ({ page }) => {
    const searchPage = new SearchPage(page);

    // Mock search API to return a predictable property card result
    await page.route("*/**/api/search**", async (route) => {
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
        page: { page: 1, pageSize: 48, total: 1, totalPages: 1, hasNextPage: false, hasPreviousPage: false },
        results: [
          { 
            id: "mock-1", 
            title: "A garden courtyard in Paldi",
            price: "₹2 Cr", 
            priceNum: 20000000,
            locality: "Paldi",
            city: "India",
            badge: "RERA Verified",
            details: { bathrooms: 2, parkingSpaces: 1, furnishing: "SEMI_FURNISHED", floorNumber: 2, totalFloors: 4, facing: "EAST", possessionLabel: "Ready to move", amenities: ["Reserved parking", "Garden or courtyard", "24×7 water", "Security", "Balcony"] }, bhk: 3, area: "1,482 sq ft", areaNum: 1482, meta: "3 BHK · Ready to move", status: "Updated 2 days ago", image: "prop-courtyard", propertyType: "APARTMENT", availability: "READY_TO_MOVE", transaction: "buy", category: "residential", subtype: "Flat/Apartment", project: "Paldi Courtyard", developer: "Architech Curated Homes", pricePerSqft: "₹12,480 / sq ft"
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

    await expect(searchPage.titleHeading).toContainText(/India/i);

    if (await searchPage.filtersButton.isVisible()) {
      await searchPage.filtersButton.click();
    }

    // Verify that the mocked result is correctly rendered as a property card
    await page.waitForTimeout(500);

    await expect(page.getByText("A garden courtyard in Paldi")).toBeVisible();
  });

  test("displays zero results state deterministically", async ({ page }) => {
    const searchPage = new SearchPage(page);

    // Mock search API to return zero results
    await page.route("*/**/api/search**", async (route) => {
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
        page: { page: 1, pageSize: 48, total: 0, totalPages: 1, hasNextPage: false, hasPreviousPage: false },
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
