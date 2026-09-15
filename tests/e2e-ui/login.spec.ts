import { test, expect } from "@playwright/test";
import { LoginPage } from "./pages/LoginPage";

test.describe("Login Journey", () => {
  test("user can switch between sign in and register tabs", async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();

    await expect(page.getByRole("heading", { name: /Welcome back to your survey/i })).toBeVisible();

    if (await loginPage.registerTab.isDisabled()) {
      test.skip(true, "Registration is disabled in this environment");
      return;
    }
    
    await loginPage.registerTab.click();

    await expect(page.getByRole("heading", { name: /Start a shortlist that follows you/i })).toBeVisible();
    await expect(page.getByLabel("Full name")).toBeVisible();
  });

  test("demo accounts login flow", async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();

    await expect(page.getByRole("heading", { name: /Preview sign-ins/i })).toBeVisible();

    await page.getByRole("button", { name: /Buyer/i }).first().click();

    // Verify fields are populated
    await expect(loginPage.emailInput).toHaveValue("buyer@example.com");
    await expect(loginPage.passwordInput).toHaveValue("demo-buyer-1234");

    // Submit
    await loginPage.signInButton.click();
    await page.waitForLoadState("networkidle");
  });

  test("shows validation errors for empty fields on submit", async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();

    await loginPage.signInButton.click();

    await expect(loginPage.emailError).toBeVisible();
    await expect(loginPage.passwordError).toBeVisible();
  });
});
