import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { globSync } from "node:fs";

/**
 * Contrast and theming contracts for solid surfaces.
 *
 * Origin: in the light theme every solid CTA link rendered its label in the
 * inherited section colour instead of its own, producing dark-on-dark buttons.
 * Cause: `a { color: inherit; text-decoration: none }` sat in unlayered CSS
 * while Tailwind utilities live in `@layer utilities`, and unlayered CSS wins
 * over any layered rule regardless of specificity — so `text-cream` on a link
 * was silently discarded. These tests pin the fix and the contrast budget.
 */
const css = readFileSync("client/src/index.css", "utf8");

const hex = (value: string) => value.match(/^#([0-9a-f]{6})$/i)?.[1] ?? "";
const luminance = (value: string) => {
  const h = hex(value);
  const channels = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const [r, g, b] = channels.map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
const token = (scope: string, name: string) => {
  const block = css.slice(css.indexOf(scope));
  return block.slice(0, block.indexOf("}")).match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`))?.[1] ?? "";
};

describe("link colour utilities survive the cascade", () => {
  it("keeps the anchor colour reset inside @layer base so text-* utilities win", () => {
    const anchorRule = css.indexOf("a { color: inherit; text-decoration: none; }");
    expect(anchorRule).toBeGreaterThan(-1);
    const enclosing = css.slice(0, anchorRule);
    const openLayers = (enclosing.match(/@layer base \{/g) ?? []).length;
    expect(openLayers).toBeGreaterThan(0);
    // the reset must be inside the base layer block, not trailing after it
    const lastLayerOpen = enclosing.lastIndexOf("@layer base {");
    const between = enclosing.slice(lastLayerOpen);
    const balance = (between.match(/\{/g) ?? []).length - (between.match(/\}/g) ?? []).length;
    expect(balance).toBeGreaterThan(0);
  });
});

describe("solid surface contrast budget (WCAG AA, 4.5:1 for the 11-12px bold stamps)", () => {
  const lightBrick = token(":root {", "brick");
  const lightCream = token(":root {", "cream");
  const lightInk = token(":root {", "ink");
  const lightPaper = token(":root {", "paper");
  const darkBrickDeep = token(".dark {", "brick-deep");
  const darkCream = token(".dark {", "cream");

  it("clears AA for clay actions in the light theme", () => {
    expect(contrast(lightBrick, lightCream)).toBeGreaterThanOrEqual(4.5);
  });

  it("clears AA for clay actions in the dark theme via the deepened surface", () => {
    expect(contrast(darkBrickDeep, darkCream)).toBeGreaterThanOrEqual(4.5);
    expect(css).toContain(".dark .clay-fill { background: var(--brick-deep); }");
  });

  it("clears AA for ink on plaster", () => {
    expect(contrast(lightPaper, lightInk)).toBeGreaterThanOrEqual(4.5);
  });
});

describe("solid action markup contracts", () => {
  const files = globSync("client/src/**/*.tsx").concat(globSync("app/**/*.tsx")).filter((f) => !f.includes(".stories."));
  const classAttrs = (src: string) =>
    [...src.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\})/g)].map((m) => (m[1] ?? m[2] ?? "").split(/\s+/).filter(Boolean));

  it("scans a non-empty set of component files", () => {
    expect(files.length).toBeGreaterThan(40);
  });

  it("tags every solid clay control with clay-fill so dark mode deepens it", () => {
    const untagged: string[] = [];
    for (const file of files) {
      for (const tokens of classAttrs(readFileSync(file, "utf8"))) {
        const isClay = tokens.includes("bg-brick") && tokens.some((t) => t.replace(/^!/, "") === "text-cream");
        const isPadded = tokens.some((t) => /^p[xy]?-/.test(t));
        const isBand = tokens.includes("py-24") || tokens.includes("py-32");
        if (isClay && isPadded && !isBand && !tokens.includes("clay-fill")) untagged.push(`${file}: ${tokens.join(" ").slice(0, 60)}`);
      }
    }
    expect(untagged).toEqual([]);
  });

  it("never fades a solid action to an unreadable ghost when disabled", () => {
    const faded: string[] = [];
    for (const file of files) {
      for (const tokens of classAttrs(readFileSync(file, "utf8"))) {
        const solid = tokens.some((t) => /^bg-(brick|night)$/.test(t));
        const fade = tokens.find((t) => /^disabled:opacity-/.test(t));
        if (solid && fade) faded.push(`${file}: ${fade}`);
      }
    }
    expect(faded).toEqual([]);
    expect(css).toContain(".btn-solid:disabled,");
  });
});
