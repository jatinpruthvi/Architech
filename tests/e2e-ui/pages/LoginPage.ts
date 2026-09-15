import { type Locator, type Page } from "@playwright/test";

export class LoginPage {
  readonly page: Page;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly signInButton: Locator;
  readonly registerTab: Locator;
  readonly emailError: Locator;
  readonly passwordError: Locator;

  constructor(page: Page) {
    this.page = page;
    this.emailInput = page.getByLabel("Email address");
    this.passwordInput = page.getByLabel("Password");
    this.signInButton = page.getByRole("button", { name: "Sign in", exact: true });
    this.registerTab = page.getByRole("tab", { name: /Create account/i });
    this.emailError = page.locator("#login-email-error");
    this.passwordError = page.locator("#login-password-error");
  }

  async goto() {
    await this.page.goto("/login");
  }

  async loginAs(email: string, password?: string) {
    await this.emailInput.fill(email);
    if (password) await this.passwordInput.fill(password);
    await this.signInButton.click();
  }

  async clickDemoAccount(name: RegExp | string) {
    await this.page.getByRole("button", { name }).first().click();
  }
}
