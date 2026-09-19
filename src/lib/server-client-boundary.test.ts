import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/* PERF-R5-002 guard: a `"use client"` boundary that nothing needs.
 *
 * A client directive on a component with no hooks, no event handlers, no
 * browser APIs and no time-dependent render output does not change what the
 * user sees — it just re-ships that file (and its imports) inside the route's
 * first-load JS. Four of them were removed in PERF-R5-002 and measured at
 * −16.7 KiB of total static JS (route deltas: −8.6 KiB on
 * /broker/requirements/[category], −5.1 KiB on /developers, −3.8 KiB on
 * /requirements, −0.3…−0.6 KiB on every /broker route via the shared layout).
 * The repo's total-static-JS budget had 3.7 KiB of headroom at the time, so
 * this was the difference between a passing and a failing budget.
 *
 * The guard pins the four conversions AND the reason they are valid: if a hook,
 * a handler or a browser API is added to one of these files, the test fails and
 * says what to do (extract the interactive part, or re-add the directive and
 * re-measure the budget) rather than letting the boundary come back silently
 * with its byte cost unaccounted for. */

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

/** Server components that must not carry a client boundary (see header). */
const SERVER_ONLY = [
  "src/components/broker/techno/RequirementTable.tsx",
  "src/components/broker/techno/WhatsAppFab.tsx",
  "src/screens/DeveloperIndexPage.tsx",
  "src/screens/RequirementsPage.tsx",
];

/** A genuinely interactive client component — the scanner's positive control. */
const CLIENT_CONTROL = "src/components/broker/techno/ResponsiveDataView.tsx";

/** Comments stripped first: these files' own notes discuss `"use client"` and
    the repo's prose discusses hooks, neither of which is a boundary. */
function code(rel: string): string {
  const src = readFileSync(join(repoRoot, rel), "utf8");
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function hasClientDirective(rel: string): boolean {
  return /^\s*["']use client["']/.test(code(rel));
}

type InteractiveReason = "hook" | "handler" | "browser-api";
const HOOK = /\buse[A-Z]\w*\s*\(/;
const HANDLER = /\son[A-Z][A-Za-z]*\s*=/;
const BROWSER = /\b(window|document|localStorage|sessionStorage|navigator|matchMedia)\b|addEventListener|requestAnimationFrame/;

function interactiveReasons(rel: string): InteractiveReason[] {
  const src = code(rel);
  const reasons: InteractiveReason[] = [];
  if (HOOK.test(src)) reasons.push("hook");
  if (HANDLER.test(src)) reasons.push("handler");
  if (BROWSER.test(src)) reasons.push("browser-api");
  return reasons;
}

describe("PERF-R5-002: no client boundary without a client reason", () => {
  /* Mutation-checked: re-adding `"use client"` to WhatsAppFab.tsx fails the
     first assertion with the re-measure message. */
  it.each(SERVER_ONLY)("%s stays a Server Component", (rel) => {
    expect(
      hasClientDirective(rel),
      `${rel} regained a "use client" directive. If it needs one, re-measure ` +
        "`pnpm test:perf` and record the byte cost in the perf report / budgets why.",
    ).toBe(false);
  });

  it.each(SERVER_ONLY)("%s still has no reason to be a Client Component", (rel) => {
    expect(
      interactiveReasons(rel),
      `${rel} now uses client-only APIs. Extract that part into its own client ` +
        "component (the pattern these files already use for ResponsiveDataView / " +
        'Reveal / RequirementCapture) rather than re-adding "use client" to the whole file.',
    ).toEqual([]);
  });

  /* A scanner that matches nothing would pass forever while every conversion
     quietly reverted — assert it detects a real boundary and a real reason. */
  it("the scan detects a genuine client boundary", () => {
    expect(hasClientDirective(CLIENT_CONTROL)).toBe(true);
    expect(interactiveReasons(CLIENT_CONTROL)).toContain("hook");
    expect(interactiveReasons(CLIENT_CONTROL)).toContain("browser-api");
  });
});
