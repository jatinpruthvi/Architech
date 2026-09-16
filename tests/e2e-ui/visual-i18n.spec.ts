import { expect, test, type Locator, type Page } from "@playwright/test";

/* Visual & Devanagari smoke suite (P1-UI-001).
 *
 * Deliberately baseline-free: pixel-diff screenshots flake under font-hinting
 * and GPU differences across CI machines, so these assert LAYOUT FACTS that
 * must hold on every machine — no horizontal overflow, Hindi actually flips
 * the document, Devanagari content renders in the right stack, and the
 * command palette journeys end-to-end in a real browser. */

const DEVANAGARI = /[ऀ-ॿ]/;

/** Public routes that carry the most layout risk (long labels, tables, CTAs). */
const ROUTES = [
  { path: "/", name: "home" },
  { path: "/search/?q=paldi", name: "search results" },
  { path: "/buy/ahmedabad/paldi/", name: "locality" },
  { path: "/listing/garden-courtyard/", name: "listing dossier" },
  { path: "/saved-searches/", name: "saved searches" },
];

/* Opens the palette through the gesture each viewport actually offers, so the
 * palette is covered on BOTH projects instead of being skipped on mobile.
 *
 * The header launcher button is `hidden md:inline-flex` (desktop-only by
 * design), so a mobile project cannot click it. But Mod+K is a global window
 * listener in CommandPaletteLauncher, not a button handler — the palette
 * itself is reachable at every viewport, which is why the keyboard tests below
 * have always passed on mobile. Skipping the whole test on mobile therefore
 * threw away real coverage of palette search, navigation and the Hindi
 * palette at a 393px viewport, which is where Devanagari layout is riskiest. */
async function openPalette(page: Page, isMobile: boolean | undefined): Promise<Locator> {
  if (isMobile) {
    await page.keyboard.press("Control+k");
  } else {
    await page.getByRole("button", { name: "Search or jump — press ⌘K" }).click();
  }
  return page.getByRole("dialog", { name: "Command palette" });
}

async function assertNoHorizontalOverflow(page: Page, label: string) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, `${label}: page must never scroll sideways (${overflow}px overflow)`).toBeLessThanOrEqual(1);
}

test.describe("viewport hygiene", () => {
  for (const route of ROUTES) {
    test(`${route.name} (${route.path}) never scrolls sideways`, async ({ page }) => {
      await page.goto(route.path);
      await expect(page.getByRole("main")).toBeVisible();
      await assertNoHorizontalOverflow(page, route.name);
    });
  }

  test("above-the-fold content is visible without scrolling", async ({ page }) => {
    await page.goto("/");
    const h1 = page.getByRole("heading", { level: 1 }).first();
    await expect(h1).toBeVisible();
    const box = await h1.boundingBox();
    expect(box && box.y < 900, "the h1 must be above the fold, not pushed down by chrome").toBeTruthy();
  });
});

test.describe("Hindi / Devanagari", () => {
  test("the toggle flips the document language and renders Devanagari without overflow", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "हिन्दी में देखें" }).click();

    /* Screen readers switch pronunciation on the document language, so the
       attribute must flip with the UI language — a purely visual swap would
       read Hindi text in an English voice. */
    await expect(page.locator("html")).toHaveAttribute("lang", "hi");

    const h1 = page.getByRole("heading", { level: 1 }).first();
    await expect(h1).toContainText(DEVANAGARI);

    /* Hindi copy typically runs longer than English; the hero is where an
       untested expansion breaks the layout. */
    await assertNoHorizontalOverflow(page, "home in Hindi");

    /* The font stack must route Devanagari to its dedicated face, not the
       Latin display face alone. */
    const fontFamily = await h1.evaluate((el) => getComputedStyle(el).fontFamily);
    expect(fontFamily).toContain("Noto Sans Devanagari");

    await page.getByRole("button", { name: "Switch to English" }).click();
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
  });

  test("a locality page keeps its structure in Hindi", async ({ page }) => {
    await page.goto("/buy/ahmedabad/paldi/");
    await page.getByRole("button", { name: "हिन्दी में देखें" }).click();
    await expect(page.locator("html")).toHaveAttribute("lang", "hi");
    await expect(page.getByRole("main")).toBeVisible();
    await assertNoHorizontalOverflow(page, "locality in Hindi");
  });
});

test.describe("command palette", () => {
  test("opens, searches, and navigates", async ({ page, isMobile }) => {
    await page.goto("/");
    const dialog = await openPalette(page, isMobile);
    await expect(dialog).toBeVisible();

    await dialog.getByPlaceholder(/Search a city, locality, PIN, BHK/).fill("paldi");
    const option = page.getByRole("option", { name: /Paldi/ }).first();
    await expect(option).toBeVisible();
    await option.click();
    await page.waitForURL(/\/buy\/ahmedabad\/paldi\/?$/);
    await expect(page.getByRole("heading", { name: /Paldi, Ahmedabad/i }).first()).toBeVisible();
  });

  test("opens on ⌘K / Ctrl+K and closes on Escape", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Control+k");
    const dialog = page.getByRole("dialog", { name: "Command palette" });
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });

  test("palette works in Hindi too", async ({ page, isMobile }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "हिन्दी में देखें" }).click();

    if (isMobile) {
      await page.keyboard.press("Control+k");
    } else {
      await page.getByRole("button", { name: "खोजें या सीधे जाएँ — ⌘K दबाएँ" }).click();
    }
    await expect(page.getByRole("dialog", { name: "कमांड पैलेट" })).toBeVisible();
    await page.keyboard.press("Escape");
  });
});
