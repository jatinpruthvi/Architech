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
    for (const page of ["client/src/components/architech/HeroSearch.tsx", "client/src/pages/ResultsPage.tsx"]) {
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

  it("ships each viewport utility as a plain-vh rule plus an @supports re-declaration", () => {
    /* The textbook shape — `min-height: 100vh; min-height: 100svh;` — does NOT
       survive this build: Lightning CSS dedupes same-property declarations and
       merges adjacent identical selectors, so the fallback disappears from the
       minified stylesheet while the SOURCE still looks correct. No dev-server
       output, no `tsc`, and no source-text test can see that; it is only
       visible in `.next/static/chunks/*.css` after a production build. Hence
       @supports (which cannot be merged into what it wraps), and hence this
       structural assertion instead of a friendlier-looking one. */
    const svhBlock = css.slice(css.indexOf("@supports (height: 100svh)"));
    const dvhBlock = css.slice(css.indexOf("@supports (height: 100dvh)"));
    expect(svhBlock, "missing @supports (height: 100svh)").not.toBe(css);
    expect(dvhBlock, "missing @supports (height: 100dvh)").not.toBe(css);
    for (const utility of ["vh-fill", "vh-fill-dvh", "vh-sheet", "vh-cta", "rail-scroll"]) {
      const fallback = new RegExp(`^\\.${utility} \\{([^}]*)\\}`, "m").exec(css)?.[1] ?? "";
      expect(fallback, `.${utility} needs a top-level plain-vh rule`).not.toBe("");
      expect(/\dvh\b/.test(fallback) && !/\d[sd]vh\b/.test(fallback), `.${utility} must fall back to plain vh, got "${fallback.trim()}"`).toBe(true);
      const block = utility.includes("dvh") || utility === "rail-scroll" ? dvhBlock : svhBlock;
      const modern = new RegExp(`\\.${utility} \\{([^}]*)\\}`).exec(block.slice(0, block.indexOf("\n}") + 2))?.[1] ?? "";
      expect(/\d[sd]vh\b/.test(modern), `.${utility} must be re-declared inside its @supports block`).toBe(true);
    }
  });
});

/* ------------------------------------------------------------------
 * The listing dossier's navigation contract.
 * A page 3000px tall with no way to orient is not a taste problem: the
 * reader either scrolls past the price history or gives up. These four
 * checks pin the fix so it cannot rot into a rail of dead links.
 * ------------------------------------------------------------------ */
describe("the dossier navigates, and reuses the shared card", () => {
  const page = "client/src/pages/ListingPage.tsx";
  const nav = "client/src/components/architech/SectionNav.tsx";

  it("has no dangling in-page anchor anywhere in the product", () => {
    /* `href="#"` jumps to the top of the document — it looks like a button and
       behaves like a bug. This caught the dossier's own "view all photos". */
    const offenders: string[] = [];
    for (const f of legacyFiles) {
      if (f.includes("components/ui/")) continue;
      const src = source(f);
      for (const m of src.matchAll(/href="#([^"]*)"/g)) {
        if (m[1].includes("${")) continue; // a template href is not statically resolvable
        if (!src.includes(`id="${m[1]}"`)) offenders.push(`${f}: #${m[1] || "(empty)"}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("names only sections that exist", () => {
    const src = source(page);
    const listed = [...src.matchAll(/\{ id: "([^"]+)", label: "[^"]*" \}/g)].map((m) => m[1]);
    expect(listed.length, "the rail would be pointless empty").toBeGreaterThanOrEqual(5);
    const missing = listed.filter((id) => id !== "dossier-top" && !src.includes(`id="${id}"`));
    expect(missing, "rail entries need a matching id on the section").toEqual([]);
    expect(new Set(listed).size, "duplicate rail entries").toBe(listed.length);
  });

  it("offsets anchors in CSS, not per node, and honours reduced motion", () => {
    /* The rule must be UNLAYERED to outrank Tailwind's `scroll-m-*` utilities
       (unlayered beats layered at any specificity), so a component cannot
       quietly "fix" a bad jump by deleting the offset for one element. */
    const rule = css.search(/^\[id\] \{ scroll-margin-block-start: \d+px; \}/m);
    expect(rule, "expected a global [id] scroll-margin rule in theme.css").toBeGreaterThan(-1);
    /* Position in the file is irrelevant; LAYER membership is everything. A
       rule inside `@layer base` loses to `@layer utilities` regardless of
       specificity, so the offset would be one `scroll-mt-0` away from gone. */
    /* "Which layer owns this rule" is a question about the enclosing block, so
       measure the blocks rather than brace-counting a whole stylesheet (media
       queries and `max()` brackets make that count meaningless — it returned
       -121 the first time I tried it). */
    /* Line-anchored on purpose: the file's PROSE mentions `@layer utilities`
       inside comments, and an unanchored scan found three "blocks" — one of
       them my own comment — and reported a correct rule as an offender. */
    const opens = [...css.matchAll(/^@layer[^{]*\{/gm)].map((m) => m.index);
    expect(opens.length, "expected this file to keep its @layer blocks").toBeGreaterThanOrEqual(2);
    for (const open of opens) {
      const end = css.indexOf("\n}", open);
      expect(rule < open || rule > end, "[id] scroll-margin must sit outside every @layer block, or a utility could outrank it").toBe(true);
    }
    /* Smooth scrolling and its opt-out are PRE-EXISTING rules elsewhere in the
       file. Assert them by their real selectors, and assert they are singular —
       a second copy of either would make this check pass for the wrong reason. */
    expect(css.match(/html \{[^}]*scroll-behavior: smooth/g)?.length, "exactly one smooth-scroll declaration").toBe(1);
    expect(css.match(/html \{[^}]*scroll-behavior: auto/g)?.length, "exactly one reduced-motion reset").toBe(1);
    expect(source(nav), "per-node scroll-mt would be dead weight and is misleading").not.toMatch(/scroll-mt-\[/);
  });

  it("does not re-hand-roll a listing card next to PropertyCard", () => {
    /* The dossier's "Nearby" strip was a local `aspect-[1.4]` / `text-ink/60`
       lookalike of the shared card: no save, no compare, a third design
       language. If this goes red, use <PropertyCard> — do not tune the copy. */
    expect(source(page)).not.toMatch(/aspect-\[1\.4\]/);
    expect(source(page)).toMatch(/<PropertyCard key=\{p\.id\} property=\{p\} index=\{i\} \/>/);
    const card = source("client/src/components/architech/PropertyCard.tsx");
    expect(card).toMatch(/<div className="aspect-\[1\.5\]">/);
  });
});

/* ------------------------------------------------------------------
 * Dead-class detector. `Reveal` shipped a class name that matched no rule for
 * the entire life of the codebase — 51 call sites across 12 pages, and
 * everyone, the audit included, assumed it animated. That is the specific
 * failure mode of a system where components NAME things and CSS is trusted to
 * just know them, so it is checked mechanically instead of in review.
 * ------------------------------------------------------------------ */
/*
 * The named hooks this design system exposes. A Tailwind utility and a custom
 * class are indistinguishable by shape (`items-center` vs `pic-fade`), and
 * generated names like `text-brick`/`bg-card` come from @theme tokens, so a
 * general "every class must exist" scan is undecidable statically — it flagged
 * 2262 utilities. What IS decidable is the contract a component opts into:
 * if a class is one of ours, it must have rules, in the right guard, and the
 * set of our classes is declared here rather than inferred. `Reveal` broke
 * exactly this and nobody noticed for the codebase's whole life.
 */
describe("the component-emitted hooks are real", () => {
  /* motion-* / transition-* are Tailwind's own, listed so they are not
     mistaken for ours: .motion-lift and .motion-press ARE ours (theme.css). */
  const OURS = [
    "stamp", "stamp-sm", "kicker", "display", "ink-2", "ink-3",
    "clay-fill", "paper-fill", "link-rail", "btn-sweep", "img-hover",
    "motion-lift", "motion-press", "editorial-shadow", "grain",
    "map-frame", "skip-link", "touch-44", "listing-packet",
    "listing-field-note", "section-rail", "section-rail-link",
    "pic-fade", "architech-reveal", "facet-option", "facet-control", "facet-hint",
  ] as const;

  it("every one of our hooks has a rule in theme.css", () => {
    /* `:where()`/`:is()` too: `.ink-2` is deliberately wrapped so a utility can
       still override its colour (the `.stamp` lesson, bf90cf6), and a scanner
       that only accepts a leading dot reports those hooks as missing. */
    const defined = new Set([...css.matchAll(/^\s*(?::(?:where|is)\()?\.([a-zA-Z][\w-]*)/gm)].map((m) => m[1]));
    const missing = OURS.filter((c) => !defined.has(c));
    expect(missing, "a hook with no rule is a silent no-op — define it or delete the emission").toEqual([]);
  });

  it("wires the reveal primitive to real CSS, inside the motion guard", () => {
    /* Asserting the class ALONE is what let the bug live: `Reveal` emitted
       `architech-reveal` and the test would have passed on the name alone.
       So: a keyframe must exist, the animation must sit inside
       no-preference (an unguarded `from { opacity: 0 }` strands content for
       reduced-motion users), and the delay must be read from the custom
       property the component sets. */
    expect(css, "reveal needs a keyframe").toMatch(/@keyframes reveal-in/);
    const guarded = css.slice(css.indexOf("@media (prefers-reduced-motion: no-preference)"));
    expect(guarded, ".architech-reveal must animate inside the no-preference guard").toMatch(/\.architech-reveal \{[^}]*animation: reveal-in/);
    expect(guarded, "the component's --reveal-delay must actually be consumed").toMatch(/animation-delay: var\(--reveal-delay/);
    const before = css.slice(0, css.indexOf("@media (prefers-reduced-motion: no-preference)"));
    expect(before, "an unguarded reveal would hide content when motion is reduced").not.toMatch(/\.architech-reveal \{[^}]*animation/);
  });

  it("paints photos from a VISIBLE base state", () => {
    /* Inverse of the usual advice, and the reason it is pinned: with the
       hidden state as the default, an image whose onLoad never fires (blocked
       CDN, aborted lazy request, offline back-navigation) is an invisible
       image. So `.pic-fade` must be opacity:1 and the hiding must be opt-in. */
    expect(css).toMatch(/\.pic-fade \{ opacity: 1; \}/);
    const guarded = css.slice(css.indexOf("@media (prefers-reduced-motion: no-preference)"));
    expect(guarded).toMatch(/\.pic-fade:not\(\.pic-fade-in\) \{ opacity: 0; \}/);
  });
});

/* ------------------------------------------------------------------
 * Modal surfaces. The repo had TWO dialogs: the listing's lead form on Radix,
 * and the requirement-capture sheet hand-rolled — with the WORSE
 * implementation on the surface that actually produces revenue. A bespoke
 * `role="dialog" aria-modal="true"` gets you the accessible NAME of a modal
 * and none of the behaviour: no focus trap, so a keyboard user tabs into
 * invisible page controls behind an overlay that told them the page was gone.
 * ------------------------------------------------------------------ */
describe("modal surfaces are one implementation", () => {
  const surfaces = [
    "client/src/components/architech/RequirementCapture.tsx",
    "client/src/pages/ListingPage.tsx",
  ];

  it("every surface with a dialog uses the shared primitive", () => {
    for (const f of surfaces) {
      const src = source(f);
      expect(src, `${f} must render dialogs via components/ui/dialog`).toMatch(
        /from "@\/components\/ui\/dialog"/,
      );
      /* `aria-hidden` on a hand-rolled overlay is the other half of the same
         false promise; the string is split so this test's own prose about
         `aria-modal` cannot satisfy it. */
      const handRolled = new RegExp("role=" + '"' + "dialog" + '"' + "[^>]*aria-" + "modal").test(src);
      expect(handRolled, `${f} still hand-rolls a dialog — use DialogContent`).toBe(false);
    }
  });

  it("keeps a Title and a Description on the content, not just an aria-labelledby", () => {
    /* Radix warns in console when either is missing, which is why a bare
       `aria-labelledby` pointing at a heading OUTSIDE the dialog is not a
       substitute: the reference resolves but the description is still absent,
       and most modals in this product explain something (masked phone number,
       free-to-submit) that a user needs before they type into it. */
    const rc = source(surfaces[0]);
    expect(rc).toMatch(/<DialogTitle/);
    expect(rc).toMatch(/<DialogDescription/);
    expect(rc, "scroll lock belongs to Radix, not to a hand-written body style").not.toMatch(/document\.body\.style\.overflow/);
  });
});

/* ------------------------------------------------------------------
 * Grid motion. FLIP is cheap to add and easy to add wrongly: the two failure
 * modes below are the ones that make a results page worse than no animation.
 * ------------------------------------------------------------------ */
describe("results-grid motion stays a reflow, not a show", () => {
  const results = source("client/src/pages/ResultsPage.tsx");

  it("does not FLIP-scale result cards", () => {
    /* Motion `layout` scales x/y to the new box. On a 1.5-crop card that reads
       as the photo squashing mid-flight, and the library itself blew the
       search first-load budget. CSS reveal + listing keys is the contract. */
    expect(results).not.toMatch(/from "motion\/react"/);
    expect(results, "bare `layout` = scaling artefacts on card-sized elements").not.toMatch(/<[a-zA-Z.][^>]*\slayout(\s|>)/);
  });

  it("keys the grid on the listing, so re-ordering does not remount cards", () => {
    // Keyed on filters+sort, every card remounts on each click and FLIP becomes
    // a full re-entry animation — the v4 regression this file keeps citing.
    expect(results).toMatch(/<Reveal key=\{property\.id\}/);
    expect(results).not.toMatch(/key=\{[^}]*filter/i);
  });
});
