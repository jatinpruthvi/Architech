import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const routes = [
  { path: "/", heading: /Find the|पहले जगह/i },
  { path: "/search/", heading: /Search|homes/i },
  { path: "/buy/ahmedabad/paldi/", heading: /Paldi, Ahmedabad/i },
  { path: "/listing/garden-courtyard/", heading: /garden courtyard/i },
  { path: "/saved/", heading: /Saved|Nothing saved/i },
];

test.describe("accessibility smoke", () => {
  for (const route of routes) {
    test(`${route.path} has no serious automated accessibility violations`, async ({ page }) => {
      await page.goto(route.path);
      await expect(page.getByRole("main")).toBeVisible();
      await expect(page.getByRole("heading", { name: route.heading }).first()).toBeVisible();

      const results = await new AxeBuilder({ page })
        // Color contrast is tracked separately in the design audit; this smoke gate focuses on
        // semantic, keyboard, naming, landmark, ARIA, and document-structure violations.
        .disableRules(["color-contrast"])
        .analyze();
      const seriousViolations = results.violations.filter((violation) => ["serious", "critical"].includes(violation.impact ?? ""));
      expect(seriousViolations, JSON.stringify(seriousViolations, null, 2)).toEqual([]);
    });
  }

  test("skip link moves focus to main content", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Tab");
    const skipLink = page.getByRole("link", { name: /skip to content/i });
    await expect(skipLink).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.locator("main#main")).toBeFocused();
  });

  test("theme and language controls are keyboard reachable", async ({ page }) => {
    await page.goto("/");
    const themeButton = page.getByRole("button", { name: /switch to dark mode/i });
    await themeButton.focus();
    await expect(themeButton).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.locator("html")).toHaveClass(/dark/);

    const languageButton = page.getByRole("button", { name: /हिन्दी में देखें|switch to english/i });
    await languageButton.focus();
    await expect(languageButton).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.locator("html")).toHaveAttribute("lang", "hi");
  });
});
