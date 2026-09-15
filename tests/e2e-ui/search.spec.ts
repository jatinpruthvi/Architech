import { test, expect } from "@playwright/test";
import { SearchPage } from "./pages/SearchPage";

/*
 * These tests deliberately do NOT mock /api/search.
 *
 * The previous version installed a page.route mock on the /api/search glob,
 * which never worked: the mock fulfilled search-shaped JSON for the
 * /api/search/suggest endpoint too, and the h1's city comes from client-side
 * resolution of the query against the city registry rather than from the
 * response body — so asserting /Bangalore/i could not pass even when the mock
 * did apply (the registry slug and display name are both "Bengaluru").
 *
 * The fixture repository is deterministic, so asserting against it directly is
 * both simpler and a stronger test. Verified against a built `next start`:
 *   GET /api/search/?q=bengaluru         -> count 18, first title
 *                                          "A ready 3 BHK in Indiranagar"
 *   GET /api/search/?q=zzzznonexistent   -> count 0
 */

test.describe("Search functionality", () => {
  test("displays search results for a city with fixture inventory", async ({ page }) => {
    const searchPage = new SearchPage(page);
    await searchPage.goto("bengaluru");

    // Results render inside <article> (PropertyCard), behind a Suspense
    // boundary, so wait for hydration rather than assuming SSR markup.
    await expect(searchPage.propertyCards.first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("A ready 3 BHK in Indiranagar").first()).toBeVisible();

    // The result count is read aloud in the h1 ("N homes to buy in …").
    await expect(searchPage.titleHeading).toContainText(/\d+ homes?/i);
  });

  test("shows the zero-result state when nothing matches", async ({ page }) => {
    const searchPage = new SearchPage(page);
    await searchPage.goto("zzzznonexistent");

    await expect(searchPage.noResultsMessage).toBeVisible({ timeout: 20_000 });
  });
});
