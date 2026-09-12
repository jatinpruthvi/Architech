import { type Locator, type Page } from "@playwright/test";

export class HomePage {
  readonly page: Page;
  readonly searchInput: Locator;
  readonly suggestionBox: Locator;
  readonly popularSearchLinks: Locator;

  constructor(page: Page) {
    this.page = page;
    this.searchInput = page.getByPlaceholder(/City, locality, project, or developer/i);
    this.suggestionBox = page.getByRole("listbox");
    this.popularSearchLinks = page.getByRole("link", { name: /Popular/i });
  }

  async goto() {
    await this.page.goto("/");
  }

  async searchFor(query: string) {
    await this.searchInput.fill(query);
  }
}
