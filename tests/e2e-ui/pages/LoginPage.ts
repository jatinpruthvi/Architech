import { type Locator, type Page, expect } from "@playwright/test";

/**
 * Page object for `/login/`.
 *
 * Rewritten after the login surface moved to phone-primary auth (PR #89): the
 * form no longer has an email field, so the old `getByLabel("Email address")`
 * and `#login-email-error` selectors resolved to nothing and every login test
 * failed at the first action.
 */
export class LoginPage {
  readonly page: Page;
  readonly phoneInput: Locator;
  readonly passwordInput: Locator;
  readonly signInButton: Locator;
  readonly registerTab: Locator;
  readonly phoneError: Locator;
  readonly passwordError: Locator;
  readonly demoHints: Locator;

  constructor(page: Page) {
    this.page = page;
    /* Labels are real <label for> associations in Login.tsx, so getByLabel is
       the stable hook: `login-phone` / `login-password`. */
    this.phoneInput = page.getByLabel("Mobile number");
    this.passwordInput = page.getByLabel("Password");
    /* The Sign in TAB is also named "Sign in", but it carries role="tab", so a
       role="button" query excludes it. Scoped to the form anyway, so this
       cannot silently start matching the tab if the markup changes. */
    this.signInButton = page.getByRole("button", { name: "Sign in", exact: true });
    this.registerTab = page.getByRole("tab", { name: /Create account/i });
    this.phoneError = page.locator("#login-phone-error");
    this.passwordError = page.locator("#login-password-error");
    /* The three preview sign-in buttons in the side panel. Matching on the demo
       OTP suffix keeps them distinct from the form's submit buttons. */
    this.demoHints = page.getByRole("button", { name: /OTP: 123456 in demo/ });
  }

  async goto() {
    await this.page.goto("/login");
  }

  /**
   * Waits for the fetched registration state to settle, then reports whether
   * account creation is actually available.
   *
   * Registration availability is not static markup: SessionContext seeds
   * `registrationAvailable` at `false`, so the server-rendered tab is always
   * disabled, and flips it only once `/api/auth/session` resolves. Sampling
   * `isDisabled()` once therefore races SSR against hydration — which is exactly
   * why this suite failed non-deterministically rather than consistently.
   */
  async waitForRegistrationSettled(timeout = 20_000): Promise<boolean> {
    try {
      await expect(this.registerTab).toBeEnabled({ timeout });
      return true;
    } catch {
      /* Never enables → genuinely closed in this environment. */
      return false;
    }
  }

  /** Clicks one of the preview sign-in cards, e.g. /Buyer/i or /Broker admin/i. */
  async clickDemoAccount(name: RegExp | string) {
    await this.demoHints.filter({ hasText: name }).first().click();
  }
}
