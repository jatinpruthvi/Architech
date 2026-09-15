import { test, expect } from "@playwright/test";
import { LoginPage } from "./pages/LoginPage";

test.describe("Login page functionality", () => {
  test("user can switch between sign in and register tabs", async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();

    // Verify login form loads (h1 is aria-hidden; assert on the visible heading).
    await expect(page.getByRole("heading", { name: /Welcome back to your survey/i })).toBeVisible();

    // Wait for the fetched registration state instead of sampling the
    // server-rendered disabled tab once (see LoginPage.waitForRegistrationSettled).
    const registrationOpen = await loginPage.waitForRegistrationSettled();
    test.skip(!registrationOpen, "Account creation is closed in this environment");

    await loginPage.registerTab.click();

    // Verify we're on the registration form.
    await expect(page.getByRole("heading", { name: /Start a shortlist that follows you/i })).toBeVisible();
    await expect(page.getByLabel("Full name")).toBeVisible();
  });

  test("demo phone credentials fill the sign-in form and sign in", async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();

    await expect(page.getByRole("heading", { name: /Preview sign-ins/i })).toBeVisible();

    // The demo buyer's real credentials (src/lib/auth/demo-accounts.ts).
    await loginPage.clickDemoAccount(/Buyer/i);

    await expect(loginPage.phoneInput).toHaveValue("9876543211");
    await expect(loginPage.passwordInput).toHaveValue("demo-buyer-1234");

    await loginPage.signInButton.click();

    // resolvePostLoginPath() sends an unscoped buyer to the shared dashboard.
    // The point of the assertion is that sign-in navigated off /login/.
    await expect(page).toHaveURL(/\/dashboard\//, { timeout: 30_000 });
  });

  test("shows validation errors for empty fields on submit", async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();

    await loginPage.signInButton.click();

    // validatePhoneSignIn() reports both fields when the form is empty.
    await expect(loginPage.phoneError).toBeVisible();
    await expect(loginPage.passwordError).toBeVisible();
  });
});
