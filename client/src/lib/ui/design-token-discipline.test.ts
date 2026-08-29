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
    // A filter row is a CHECKED state on the inventory, not a pressed toggle on
    // the button, so the row moved to role="checkbox"/aria-checked. The rule must
    // answer to both while `.facet-control` (a genuine toggle: the budget preset)
    // keeps aria-pressed.
    expect(facetBlock).toMatch(/\.facet-option\[aria-checked="true"\][^{]*\{[^}]*--sand/);
    expect(facetBlock).not.toMatch(/\.facet-option\[aria-checked="true"\][^{]*\{[^}]*background:\s*var\(--brick\)/);
    expect(facetBlock).toMatch(/\.facet-control\[aria-pressed="true"\]/);
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

/* ------------------------------------------------------------------ *
 * ARIA wiring: controls that LOOK complete and are inert.
 * Each check below corresponds to something real in this repo the day it was
 * written — a `role="listbox"` reachable only by mouse, a `role="group"` that
 * silently erased the count a <ul> announces, and an
 * `aria-expanded={focused && (queryLen > 0 || true)}` that could never be false.
 * ------------------------------------------------------------------ */
describe("aria wiring is wired, not merely present", () => {
  const strip = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|\s)\/\/[^\n]*/g, "$1");
  const scanned = legacyFiles.map((f) => [f, strip(source(f))] as const);

  it("never asserts an aria state that cannot be false", () => {
    const tautologies: string[] = [];
    for (const [file, src] of scanned) {
      for (const m of src.matchAll(/aria-(expanded|selected|pressed|checked)=\{([^}]*)\}/g)) {
        const expr = m[2];
        const always = /\|\|\s*(?:true|1)\b/.test(expr) || /&&\s*true\b/.test(expr) || /^\s*(?:true|1)\s*$/.test(expr);
        if (always) tautologies.push(`${file}: aria-${m[1]}={${expr}}`);
      }
    }
    expect(tautologies, "always-true aria-* tells AT the panel is open when it is absent from the DOM").toEqual([]);
  });

  it("gives every listbox the keyboard it promises", () => {
    // role="listbox" makes AT move a virtual cursor INTO the list and suppress
    // normal browse keys. Without arrows + Enter that is a net LOSS of
    // function, so an unwired listbox must fail louder than an absent one.
    const offenders: string[] = [];
    for (const [file, src] of scanned) {
      if (!/role="listbox"/.test(src)) continue;
      const shares = src.includes("useSuggestCombobox"); // keys live in the shared module
      const hasArrows = /"(ArrowDown|ArrowUp)"|\bArrowDown\b/.test(src);
      const hasEnter = /"Enter"|\bsubmit\b|\bcommit\b/.test(src);
      if (!shares && (!hasArrows || !hasEnter)) offenders.push(file);
    }
    expect(offenders).toEqual([]);
  });

  it("routes both search boxes through the one combobox module", () => {
    // The drift itself is what must not come back: the hero had arrow keys,
    // the results page did not, and both claimed to be the same control.
    for (const page of ["client/src/pages/Home.tsx", "client/src/pages/ResultsPage.tsx"]) {
      expect(source(page), `${page} must use the shared combobox`).toContain("useSuggestCombobox");
      expect(strip(source(page)), `${page} must not re-implement the combobox keys`).not.toMatch(/const onKeyDown = \(e: React\.KeyboardEvent/);
    }
  });

  it("keeps every <ul> announcing that it is a list", () => {
    // The a11y tree exposes a <ul> as a list only while list semantics survive;
    // Tailwind's preflight zeroes list-style, and a `role="group"` on the <ul>
    // erases what is left. Both lose the ITEM COUNT, which on a filter row is
    // the entire information ("3 of 14 homes"). One attribute restores it.
    const offenders: string[] = [];
    for (const [file, src] of scanned) {
      for (const m of src.matchAll(/<ul(\s[^>]*?)?>/gs)) {
        if (!/role="list"/.test(m[1] ?? "")) offenders.push(`${file}: <ul${(m[1] ?? "").replace(/\s+/g, " ").slice(0, 60)}>`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

/* ------------------------------------------------------------------ *
 * Mobile viewport geometry.
 * `min-h-screen` and `100vh` mean the URL-BAR-HIDDEN viewport on Chrome
 * Android, so a full-height surface is 15-20% too tall and its bottom edge —
 * usually the primary CTA — is unreachable until the user scrolls enough for
 * the bar to collapse. This is invisible in every desktop devtools, so it is
 * pinned here instead of in review.
 * ------------------------------------------------------------------ */
describe("viewport geometry is mobile-real", () => {
  // Vendored primitives are exempt (upstream, patched by hand once); the
  // Storybook harness is exempt because it deliberately mimics a device frame
  // rather than shipping to anyone's phone.
  const isProductSurface = (f: string) =>
    !f.includes("components/ui/") && !f.includes(".stories.") && !f.includes("/stories/");
  const geometryFiles = legacyFiles.filter(isProductSurface);

  it("never sizes a full-height surface with 100vh or min-h-screen", () => {
    const offenders: string[] = [];
    for (const file of geometryFiles) {
      const src = source(file);
      for (const m of src.matchAll(/100vh|min-h-screen|h-screen(?![\w-])/g)) {
        const line = src.slice(0, m.index).split("\n").length;
        offenders.push(`${file}:${line} ${m[0]}`);
      }
    }
    expect(
      offenders,
      "use .vh-fill (svh: must always fit), .rail-scroll (dvh: sticky panel) or .vh-sheet — see theme.css for which is which",
    ).toEqual([]);
  });

  it("gives every fixed bottom bar the safe-area inset", () => {
    // A bottom bar without the inset keeps a 44px target tappable but clips its
    // own label under the gesture strip — the failure nobody sees on a Mac.
    const offenders: string[] = [];
    for (const file of geometryFiles) {
      const src = source(file);
      for (const m of src.matchAll(/className="([^"]*fixed[^"]*bottom-0[^"]*)"/g)) {
        if (m[1].includes("safe-bottom")) continue;
        /* The inset legitimately lives on the bar's own inner container (that is
           where the padding is), so look ahead into the element it opens instead
           of demanding the class sit on the outer wrapper. */
        const window = src.slice(m.index, m.index + 700);
        if (/safe-bottom/.test(window)) continue;
        offenders.push(`${file}: ${m[1].slice(0, 70)}`);
      }
    }
    expect(offenders, "fixed bottom chrome needs .safe-bottom (see theme.css)").toEqual([]);
  });

  it("ships every viewport utility as a minifier-proof fallback + @supports pair", () => {
    /* Browsers without the dynamic units (Safari < 15.4, Chrome < 108) ignore
       `100svh` outright, so a utility that declares only the modern unit
       collapses to `auto` there. The obvious fix — two declarations for one
       property — does NOT survive this build: Turbopack's Lightning CSS drops
       the "duplicate" fallback. So the contract is a top-level plain-`vh` rule
       PLUS the same selector inside an `@supports` block. */
    const supportsSvh = css.slice(css.search(/@supports \(height: 100svh\)/));
    const supportsDvh = css.slice(css.search(/@supports \(height: 100dvh\)/));
    for (const utility of ["vh-fill", "vh-fill-dvh", "vh-sheet", "vh-cta", "rail-scroll"]) {
      const fallback = css.match(new RegExp(`^\\.${utility} \\{([^}]*)\\}`, "m"))?.[1] ?? "";
      expect(fallback, `.${utility} needs a top-level plain-vh rule`).not.toBe("");
      expect(/\dvh\b/.test(fallback) && !/\d(?:s|d|l)vh\b/.test(fallback), `.${utility} fallback must be plain vh, got "${fallback.trim()}"`).toBe(true);
      const inSupports = new RegExp(`\\.${utility} \\{([^}]*)\\}`).test(
        fallback.includes("dvh") ? supportsDvh : supportsSvh,
      );
      expect(inSupports, `.${utility} must be re-declared inside the matching @supports block`).toBe(true);
    }
  });
});
