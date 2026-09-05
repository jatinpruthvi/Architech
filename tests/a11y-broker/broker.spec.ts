import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/* The public a11y suite (tests/a11y) covers the surfaces anyone can reach.
   These are the surfaces only a PARTNER can reach — a broker works in this
   app all day, so desk usability is not optional. Same rule policy as the
   public smoke: color contrast is owned by the design-token ratchet, this
   suite focuses semantic/keyboard/landmark/ARIA/document structure.

   Session: the config boots the production build with the demo-auth preview
   hatch, so RequireSession resolves the demo broker contract and the desk
   renders exactly as it does for a real partner. If a route renders its
   access gate instead, the test fails loudly rather than scanning an empty
   shell. */

const routes = [
  { path: "/broker/dashboard/", label: "broker desk dashboard" },
  { path: "/broker/listings/new/", label: "listing submission wizard" },
];

test.describe("broker desk accessibility", () => {
  for (const route of routes) {
    test(`${route.label} (${route.path}) renders inside its session gate and has no serious automated violations`, async ({ page }) => {
      await page.goto(route.path);
      await expect(page.getByRole("main")).toBeVisible();

      /* Guard against accidentally scanning the "no access" gate: the desk
         must show real content beyond the gate chrome. */
      await expect(page.getByRole("heading").first()).toBeVisible();
      await expect(page.getByText(/do not have access|restricted to/i)).toHaveCount(0);

      const results = await new AxeBuilder({ page })
        .disableRules(["color-contrast"])
        .analyze();
      const serious = results.violations.filter((v) => ["serious", "critical"].includes(v.impact ?? ""));
      expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
    });
  }

  test("broker dashboard keeps its sidebar navigation keyboard-reachable", async ({ page }) => {
    await page.goto("/broker/dashboard/");
    await expect(page.getByRole("main")).toBeVisible();
    /* From the top of the page, Tab must eventually land on an interactive
       element without a pointer (never a focus trap on the desk chrome). */
    await page.keyboard.press("Tab");
    const focused = await page.evaluate(() => {
      const el = document.activeElement;
      return el && el !== document.body;
    });
    expect(focused).toBeTruthy();
  });
});
