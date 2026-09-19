import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { REVEAL_CLASS, REVEAL_MAX_DELAY_MS, revealDelayMs } from "@/components/architech/Reveal";

/* THE REVEAL PRIMITIVE, BOTH HALVES.
 *
 * This repo has shipped the same defect twice, in opposite directions:
 *   1. `Reveal` emitted `architech-reveal` + `--reveal-delay` and theme.css had
 *      no rule for either, so 45 call sites were plain wrapper divs (theme.css
 *      documents this).
 *   2. theme.css then defined the animation, and Reveal was switched to a
 *      component library that emitted neither the class nor the custom
 *      property — so the CSS was wired to nothing again, and 116.8 KiB of
 *      animation runtime rode 16 routes' first load (PERF-R5-006).
 *
 * `design-token-discipline.test.ts` pins the CSS half ("the hook has a rule,
 * inside the motion guard"). Nothing pinned the component half, which is why
 * both failures were possible. This file pins the SEAM: the class and custom
 * property the component emits must be the ones the stylesheet consumes, and
 * the component must stay library-free (no runtime, and therefore no client
 * boundary). */

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

/** Non-test source files (tests may legitimately discuss a library by name). */
function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "node_modules" || entry === ".next") continue;
      out.push(...sourceFiles(full));
    } else if (/\.tsx?$/.test(entry) && !/\.(test|spec|stories)\.tsx?$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}
const component = readFileSync(join(root, "src/components/architech/Reveal.tsx"), "utf8");
const css = readFileSync(join(root, "src/theme.css"), "utf8");

describe("reveal delay clamping", () => {
  it("clamps to the documented range", () => {
    expect(revealDelayMs(0)).toBe(0);
    expect(revealDelayMs(150)).toBe(150);
    expect(revealDelayMs(REVEAL_MAX_DELAY_MS)).toBe(REVEAL_MAX_DELAY_MS);
    expect(revealDelayMs(99_999)).toBe(REVEAL_MAX_DELAY_MS);
  });

  it("never emits a negative delay or a non-finite one", () => {
    /* A negative delay runs the animation already-finished; `NaNms` voids the
       whole declaration, so the entrance would silently not exist. */
    expect(revealDelayMs(-40)).toBe(0);
    expect(revealDelayMs(Number.NaN)).toBe(0);
    expect(revealDelayMs(Number.POSITIVE_INFINITY)).toBe(0);
    expect(revealDelayMs(Number.NEGATIVE_INFINITY)).toBe(0);
  });

  it("caps at the value theme.css documents (320ms)", () => {
    expect(REVEAL_MAX_DELAY_MS).toBe(320);
    expect(css, "the stylesheet must agree with the component's cap").toMatch(/capped at 320ms/);
  });
});

describe("the seam between Reveal and theme.css", () => {
  it("emits exactly the hook the stylesheet animates", () => {
    expect(REVEAL_CLASS).toBe("architech-reveal");
    expect(component).toContain("--reveal-delay");
    // The stylesheet's rule and the property it reads.
    expect(css).toMatch(/\.architech-reveal \{[^}]*animation: reveal-in/);
    expect(css).toMatch(/animation-delay: var\(--reveal-delay/);
  });

  it("keeps the entrance in the stylesheet, not in a runtime", () => {
    /* No component library, and no `"use client"`: a reveal that needs neither
       hooks nor handlers must not put itself (or its imports) in the client
       bundle. If a future change needs JS here, that is a deliberate decision
       to re-measure `/search` and the 15 other routes the library used to ride. */
    expect(component, "Reveal must not import an animation library").not.toMatch(/from "motion\/react"|from "framer-motion"/);
    expect(component, "Reveal stays a Server Component: CSS does the entrance").not.toMatch(/^\s*["']use client["']/m);
  });

  /* The library's single consumer was this component. If it comes back, the
     failure names the cost instead of quietly adding 116.8 KiB to 16 routes. */
  it("no source module imports an animation runtime", () => {
    const offenders = sourceFiles(join(root, "src")).filter((file) =>
      /from\s+["'](motion|framer-motion)(\/[^"']*)?["']/.test(stripComments(readFileSync(file, "utf8"))),
    );
    expect(
      offenders.map((f) => f.replace(root + "/", "")),
      "an animation runtime is imported again. Measured cost of the last one (motion/react): " +
        "116.8 KiB of first-load JS on 16 routes, /search among them (PERF-R5-006). " +
        "The entrance primitive is CSS (.architech-reveal) — extend that instead.",
    ).toEqual([]);
  });
});
