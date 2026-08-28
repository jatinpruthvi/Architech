import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

/**
 * Regression guard for the "search bar shows two outer borders on click" bug.
 *
 * A text input matches `:focus-visible` even for a plain mouse click, so the
 * global `input:focus-visible { outline: 3px ... }` base rule used to paint a
 * second, offset ring inside the search shell's own border. Tailwind's
 * `focus:outline-none` could not cancel it because utilities live in
 * `@layer utilities` while that base rule is unlayered — unlayered CSS always
 * beats layered CSS regardless of specificity.
 *
 * The contract now: a composed field (`.field-shell`) owns exactly one focus
 * edge, and the text control inside it draws none.
 */
const css = readFileSync("client/src/theme.css", "utf8");
const home = readFileSync("client/src/pages/Home.tsx", "utf8");
const results = readFileSync("client/src/pages/ResultsPage.tsx", "utf8");

describe("composed field focus styling", () => {
  it("cancels the base focus outline on controls inside a field shell", () => {
    expect(css).toMatch(/\.field-shell :is\(input, textarea\):focus,\s*\n\s*\.field-shell :is\(input, textarea\):focus-visible \{ outline: none; \}/);
  });

  it("moves the focus edge onto the shell itself", () => {
    expect(css).toContain(".field-shell:has(:is(input, textarea):focus)");
    expect(css).toMatch(/\.field-shell:has\(:is\(input, textarea\):focus\) \{\s*\n\s*outline: 2px solid var\(--field-focus, var\(--brick\)\);/);
  });

  it("keeps a single focus edge on engines without :has() support", () => {
    expect(css).toContain("@supports not selector(:has(input))");
    expect(css).toContain(".field-shell:focus-within { outline: 2px solid var(--field-focus, var(--brick)); outline-offset: 0; }");
  });

  it("hugs the shell border so the focus edge never reads as a second border", () => {
    const shellRule = css.slice(css.indexOf(".field-shell:has("));
    expect(shellRule.slice(0, 200)).toContain("outline-offset: 0;");
  });
});

describe("search bars opt into the shared field shell", () => {
  it("uses the shell on the hero search composer without stacking an extra ring", () => {
    const composer = home.split("\n").find((line) => line.includes("search-composer")) ?? "";
    expect(composer).toContain("field-shell");
    expect(composer).toContain("[--field-focus:var(--ember)]");
    expect(composer).not.toContain("focus-within:ring");
  });

  it("uses the shell on the results search form", () => {
    const form = results.split("\n").find((line) => line.includes('aria-label="Search homes"')) ?? "";
    expect(form).toContain("field-shell");
    expect(form).not.toContain("focus-within:ring");
  });
});
