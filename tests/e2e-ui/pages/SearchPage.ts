import { type Locator, type Page } from "@playwright/test";

export class SearchPage {
  readonly page: Page;
  readonly filtersButton: Locator;
  readonly propertyCards: Locator;
  readonly noResultsMessage: Locator;
  readonly titleHeading: Locator;

  constructor(page: Page) {
    this.page = page;
    this.filtersButton = page.getByRole("button", { name: /Filters/i }).first();
    this.propertyCards = page.locator("article");
    this.noResultsMessage = page.getByText(/Field note \/ inventory watch/i);
    this.titleHeading = page.locator("h1");
  }

  async goto(query: string) {
    await this.page.goto(`/search?q=${encodeURIComponent(query)}`);
  }
}
