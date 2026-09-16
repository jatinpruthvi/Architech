import { type Locator, type Page } from "@playwright/test";

export class SearchPage {
  readonly page: Page;
  readonly filtersButton: Locator;
  readonly propertyCards: Locator;
  readonly noResultsMessage: Locator;
  readonly titleHeading: Locator;

  constructor(page: Page) {
    this.page = page;
    this.filtersButton = page.getByRole("button", { name: /Filters/i });
    this.propertyCards = page.locator("article");
    this.noResultsMessage = page.getByText(/No homes match/i);
    this.titleHeading = page.locator("h1");
  }

  async goto(query: string) {
    /* Trailing slash: /search 308-redirects to /search/, so request the
       canonical form and skip a needless redirect on every test. */
    await this.page.goto(`/search/?q=${encodeURIComponent(query)}`);
  }
}
