import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";

/**
 * Design-token discipline guards for the Architech filter rebuild.
 *
 * Origin: the audit measured 359 `!text-[9|10|11]px` overrides and 418
 * `text-ink/NN` alpha labels across 39 files. Two of those patterns are bugs,
 * not just taste: at 9px a mono uppercase label with +0.06em tracking is not
 * legible (a stamp's whole job is to be read at a glance), and an alpha label
 * over a warm card drifts below AA — `text-ink/45` measures 2.81:1 in light
 * while `text-cream/45` measures 3.73:1 in dark, so the hierarchy literally
 * INVERTS between themes. That is why the fix is semantic tokens with
 * per-theme values, never a new alpha number.
 *
 * These checks are ratchets, not a whitelist: every file carries its current
 * count in design-token-baseline.json and may only go DOWN. Paying debt down
 * never breaks the build; adding any of it does. `node
 * client/src/lib/ui/design-token-baseline.cjs --write` re-locks a lower level.
 */
const css = readFileSync("client/src/theme.css", "utf8");
type Budget = { alphaText?: number; microText?: number; nanoText?: number };
const baseline = JSON.parse(readFileSync("client/src/lib/ui/design-token-baseline.json", "utf8")) as Record<string, Budget>;

const legacyFiles = execSync(
  "grep -rl --include='*.tsx' '' client/src app | grep -v '\\.test\\.' | grep -v '\\.stories\\.'",
  { encoding: "utf8" },
)
  .split("\n")
  .filter(Boolean);

const source = (file: string) => readFileSync(file, "utf8");
const countIn = (pattern: RegExp) => legacyFiles.reduce((sum, f) => sum + (source(f).match(pattern) ?? []).length, 0);

/** Files may be listed under either path spelling; resolve to what grep printed. */
const file0 = (f: string) => (baseline[f] ? f : f.replace(/^client\/src\//, ""));

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
/** First declaration of `--name` inside a selector block, scanning from a marker. */
const tokenAfter = (selector: string, name: string) => {
  const start = css.indexOf(selector);
  expect(start, `theme.css must contain ${selector}`).toBeGreaterThan(-1);
  const block = css.slice(start, css.indexOf("}", start));
  const rootFallback = block.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`))?.[1];
  if (rootFallback) return rootFallback;
  // `.dark` may deliberately inherit a `:root` token; that is a bug for the ink
  // ramp specifically, which is why the ink test below also asserts a dark value.
  return css.match(new RegExp(`:root\\s*\\{[^}]*--${name}:\\s*(#[0-9a-fA-F]{6})`, "s"))?.[1] ?? "";
};

describe("micro type is gone, not just relabelled", () => {
  it("never adds a 9px override, and never re-adds one where it was deleted", () => {
    // 9px is the pattern the audit demanded be deleted. Deleting it repo-wide is
    // a 40-site codemod that belongs to its own PR, so this is a ratchet rather
    // than a global zero: `nanoText` is a per-file budget, a NEW file with any
    // 9px fails the coverage test below, and the files this rebuild touched are
    // pinned at zero in their own test.
    const offenders = legacyFiles
      .map((f) => {
        const used = (source(f).replace(/\/\*[\s\S]*?\*\//g, "").match(/!text-\[9px\]/g) ?? []).length;
        const budget = baseline[file0(f)]?.nanoText ?? 0;
        return [f, used, budget] as const;
      })
      .filter(([, used, budget]) => used > budget);
    expect(offenders).toEqual([]);
  });

  it("has nothing below 9px either", () => {
    expect(countIn(/!text-\[[1-8]px\]/g)).toBe(0);
  });

  it("keeps .stamp at a legible 12px floor", () => {
    const rule = css.match(/^\.stamp\s*\{([^}]*)\}/m)?.[1] ?? "";
    expect(rule).not.toBe("");
    const size = Number(/font-size:\s*(\d+(?:\.\d+)?)px/.exec(rule)?.[1] ?? 0);
    expect(size).toBeGreaterThanOrEqual(12);
  });

  it("gives .stamp a default colour that CANNOT beat an explicit one", () => {
    // The stamp used to hardcode `text-ink/45` at each call site — 240 places
    // all agreeing on a 2.81:1 label. `.stamp` supplies the default now. But
    // 149 sites legitimately pair it with `text-trust` / `text-brick`, and an
    // UNLAYERED rule outranks a layered utility regardless of specificity, so
    // an unwrapped colour on `.stamp` mutes all 149. `:where()` keeps the
    // default and the override both true. (This is the same trap as the
    // `a { color: inherit }` bug pinned in surface-contrast.test.ts — it
    // arrived here as MY fix, which is why it is pinned rather than reviewed.)
    expect(css).toContain(":where(.stamp) { color: var(--muted-foreground); }");
    expect(css).not.toMatch(/^\.stamp \{[^}]*color:/m);
    expect(css).toContain(":where(.ink-2) { color: var(--ink-2, #51453d); }");
    expect(css).toContain(":where(.ink-3) { color: var(--ink-3, #6e6058); }");
  });
});

describe("legacy debt may only shrink", () => {
  it("scans a non-empty set of component files", () => {
    expect(legacyFiles.length).toBeGreaterThan(40);
  });

  it("matches the baseline file set exactly so the ratchet cannot be dodged", () => {
    const tracked = Object.keys(baseline).filter((k) => !k.startsWith("_"));
    const offenders = legacyFiles.filter((f) => {
      const src = source(f);
      return /text-(?:ink|cream|foreground|muted-foreground)\/\d+|!text-\[1[01]px\]/.test(src);
    });
    expect(new Set(tracked)).toEqual(new Set(offenders));
  });

  it.each(legacyFiles.map((f) => [f] as const))("%s stays at or under its baseline", (file) => {
    const src = source(file);
    const allowed = baseline[file] ?? { alphaText: 0, microText: 0 };
    const alphaText = (src.match(/text-(?:ink|cream|foreground|muted-foreground)\/\d+/g) ?? []).length;
    const microText = (src.match(/!text-\[1[01]px\]/g) ?? []).length;
    const hint =
      alphaText > (allowed.alphaText ?? 0)
        ? "Replace alpha labels with .ink-2 / .ink-3 (they carry per-theme values, so both themes stay AA)."
        : microText > (allowed.microText ?? 0)
          ? "Drop the size override and let .stamp/.kicker own type size, or move to 12px/13px."
          : "";
    expect(
      { alphaText, microText },
      `${file} grew legacy debt past its baseline. ${hint}`,
    ).toEqual(expect.objectContaining({
      alphaText: expect.any(Number),
      microText: expect.any(Number),
    }));
    expect(alphaText, `${file}: alpha labels over baseline. ${hint}`).toBeLessThanOrEqual(allowed.alphaText ?? 0);
    expect(microText, `${file}: micro-text overrides over baseline. ${hint}`).toBeLessThanOrEqual(allowed.microText ?? 0);
  });

  it("keeps the files this rebuild already cleaned at zero", () => {
    // Regression lock for the rebuild itself: these three are debt-free now.
    for (const file of [
      "client/src/components/architech/FilterSurface.tsx",
      "client/src/pages/ResultsPage.tsx",
      "client/src/components/architech/PropertyCard.tsx",
    ]) {
      const clean = source(file).replace(/\/\*[\s\S]*?\*\//g, "");
      expect([file, (clean.match(/text-(?:ink|cream)\/(?:[1-5]\d)\b/g) ?? []).length], `${file} reintroduced a low-alpha label`).toEqual([file, 0]);
      expect([file, (clean.match(/!text-\[(9|10|11)px\]/g) ?? []).length], `${file} reintroduced micro text`).toEqual([file, 0]);
    }
  });
});

describe("ink ramp tokens clear AA in BOTH themes", () => {
  it.each([
    { theme: "light", card: "#fffaf2", ink2: "#51453d", ink3: "#6e6058" },
    { theme: "dark", card: "#33251f", ink2: "#c9b8ab", ink3: "#a9998d" },
  ])("$theme secondary ink clears 5:1 and tertiary clears 4.5:1", ({ card, ink2, ink3 }) => {
    expect(contrast(card, ink2)).toBeGreaterThanOrEqual(5);
    expect(contrast(card, ink3)).toBeGreaterThanOrEqual(4.5);
  });

  it("declares both ink steps per theme rather than inheriting one light value", () => {
    // theme.css carries a head `:root` AND a trailing token block (the ink ramp
    // lives there), so every declaration of a theme selector must be considered.
    // A bare `indexOf(":root")` walks into `@theme inline`'s braces instead and
    // passes vacuously — which is exactly how a missing dark value hides.
    const bodiesFor = (selector: string) =>
      [...css.matchAll(new RegExp(`${selector.replace(".", "\\.")}\\s*\\{`, "g"))].map(
        (m) => css.slice(m.index! + m[0].length, css.indexOf("}", m.index!)),
      );
    for (const [selector, names] of [
      [":root", ["--ink-2", "--ink-3", "--facet-link", "--facet-border"]],
      [".dark", ["--ink-2", "--ink-3", "--facet-link", "--facet-border"]],
    ] as const) {
      const all = bodiesFor(selector).join("\n");
      for (const name of names) {
        expect(all, `${selector} must define ${name} — an ink token that only exists in one theme is the inversion bug again`).toContain(name);
      }
    }
  });

  it("wires the facet surface to those tokens, not to raw colours", () => {
    const facetBlock = css.slice(css.indexOf("@layer components"));
    expect(facetBlock).toContain("--muted-foreground");
    expect(facetBlock).toContain("--rule-soft");
    // Selection must read as fill + edge + check; a solid clay field with a
    // cream label is the low-contrast pattern this rebuild exists to remove.
    expect(facetBlock).toMatch(/\.facet-option\[aria-pressed="true"\]\s*\{[^}]*--sand/);
    expect(facetBlock).not.toMatch(/\.facet-option\[aria-pressed="true"\]\s*\{[^}]*background:\s*var\(--brick\)/);
  });
});

describe("the filter surface works without a mouse", () => {
  const surface = source("client/src/components/architech/FilterSurface.tsx");
  const clean = surface.replace(/\/\*[\s\S]*?\*\//g, "");

  it("never gates a control behind hover", () => {
    // Traffic is roughly half touch, and this is the primary task for both
    // audiences — so `hidden md:*` / `opacity-0 group-hover:` on a control is a
    // missing feature, not a progressive enhancement.
    expect(clean).not.toMatch(/opacity-0[^"'`]*group-hover:opacity-100/);
    expect(clean).not.toMatch(/hidden\s+md:grid/);
  });

  it("expresses zero-result facets as disabled, not hidden", () => {
    // A `(0)` result has to stay visible and READ as unavailable. Hiding it
    // teaches the person that the filter is broken; a dashed zero tells them
    // the inventory is what is scarce — and keeps the facet honest about itself.
    expect(clean).toMatch(/aria-disabled=\{dead \|\| undefined\}/);
    expect(clean).not.toMatch(/\.filter\([^)]*count === 0\)/);
    const rule = css.match(/\.facet-option\[aria-disabled="true"\]\s*\{([^}]*)\}/)?.[1] ?? "";
    expect(rule).toContain("not-allowed");
    // …and the hover affordance has to back off for exactly those rows.
    expect(css).toMatch(/\.facet-option:hover:not\(\[aria-disabled="true"\]\)/);
  });

  it("keeps every control at a 44px touch target", () => {
    // Sizing is delegated on purpose: a control is 44px if it carries the
    // touch-44 / h-11 utility or the .facet-link / .facet-control component
    // class, and those two classes declare the floor in theme.css. So the test
    // pins BOTH halves — a component that stops using them, or a stylesheet
    // that drops the min-height, fails here instead of shipping mis-taps.
    for (const rule of ["facet-link", "facet-control", "facet-option"]) {
      const body = css.match(new RegExp("\\."+rule+" \\{([^}]*)\\}"))?.[1] ?? "";
      expect(body, `.${rule} must exist in theme.css`).not.toBe("");
      expect(body, `.${rule} is the 44px floor for keyboard-only controls`).toMatch(/min-height:\s*44px/);
    }
    const allowed = /(?:^|:)(?:touch-44|h-11|min-h-[44px]|facet-link|facet-control|facet-option)$/;
    const undersized: string[] = [];
    for (const m of clean.matchAll(/<button[\s\S]*?className=(?:"([^"]*)"|\{`([^`]*)`\})/g)) {
      const classes = (m[1] ?? m[2] ?? "").split(/[\s`"]+/).filter(Boolean);
      if (classes.some((c) => allowed.test(c))) continue;
      undersized.push(`FilterSurface.tsx:${clean.slice(0, m.index).split("\n").length} [${classes.join(" ")}]`);
    }
    expect(undersized, "facet controls are tapped in a bottom sheet — anything under 44px is a mis-tap").toEqual([]);
  });

  it("does not let small mono labels sit at 4.5:1 or worse in either theme", () => {
    // `--brick` is 5.77:1 in light but only 4.16:1 in dark. That is fine for a
    // 26px display price and short for a 12px mono action, so small actions use
    // --facet-link (5.31:1 in dark). This pins both halves of that decision.
    expect(contrast(tokenAfter(":root", "brick"), tokenAfter(":root", "card"))).toBeGreaterThanOrEqual(4.5);
    const darkBlock = css.slice(css.indexOf(".dark {"));
    const darkCard = darkBlock.slice(0, darkBlock.indexOf("}")).match(/--card:\s*(#[0-9a-fA-F]{6})/)?.[1] ?? "";
    expect(darkCard).not.toBe("");
    expect(contrast("#d36a48", darkCard)).toBeLessThan(4.5); // the trap this token exists to avoid
    expect(css).toContain("--facet-link: color-mix(in srgb, var(--brick) 82%, #fff);");
    expect(css).toMatch(/\.facet-link \{[\s\S]*?color: var\(--facet-link\)/);
  });
});
