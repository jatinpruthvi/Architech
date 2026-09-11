import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

/* Bug-hunt round 4, §6 item 1 — CI source guard for the defect class that
   produced THREE separate bugs in this repo (BUG-R4-001 metrics series,
   BUG-R4-002 mutation rate-limit buckets, BUG-R4-003 login throttle buckets):
   a module-level Map/Set whose *contents* are bounded but whose *entry count*
   is not, keyed by data crossing the trust boundary.

   Rule: a module-level `new Map(`/`new Set(` that is WRITTEN at runtime must
   have a bounded lifecycle, demonstrated by one of:
     - an eviction path on that identifier (`.delete(`/`.clear(`), or
     - the shared BoundedWindowMap helper in the same module, or
     - an explicit `bounded-state: <reason>` marker within 500 characters
       before the declaration, stating why the entry count cannot grow.

   Maps that are never mutated after construction (static lookup tables built
   from a literal or a fixture registry) are exempt — their size is fixed by the
   source, not by traffic.

   Source-level scan, following the precedent of sql-query-bounds.test.ts and
   governance/server-query-caps.test.ts: most of these modules import
   "server-only" and cannot be imported under plain vitest. */

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SCAN_ROOTS = ["src", "src/app", "src/shared"];
const DECL = /^\s*(?:export\s+)?(?:const|let|var)\s+([A-Za-z0-9_$]+)\s*(?::[^=]+)?=\s*new (Map|Set)\s*[<(]/;
const MARKER = /bounded-state:/;
/* 1200 rather than the 500 used by sql-query-bounds.test.ts: a single marker
   documents a whole GROUP of sibling declarations (broker/channel.ts declares
   seven demo-store Maps in a row), and one long typed declaration line is
   enough to push the token out of a 500-char window for the ones below it. */
const MARKER_WINDOW = 1200;

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!/node_modules|\.next/.test(entry.name)) walk(full, out);
    } else if (entry.name.endsWith(".ts") && !entry.name.includes(".test.")) {
      out.push(full);
    }
  }
  return out;
}

/** Declarations that sit at module scope, tracked by brace depth so that a
    `new Map()` inside a function body (a per-call temporary, correctly bounded
    by the call) is not reported. */
function moduleLevelDeclarations(src: string): { name: string; line: number }[] {
  const lines = src.split("\n");
  let depth = 0;
  const found: { name: string; line: number }[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    if (depth === 0) {
      const match = lines[i].match(DECL);
      if (match) found.push({ name: match[1], line: i + 1 });
    }
    for (const character of lines[i]) {
      if (character === "{") depth += 1;
      else if (character === "}") depth -= 1;
    }
  }
  return found;
}

/** Strip the bodies of test-reset helpers (`resetXForTests`, `clearXForTests`).
    BUG-R4-007 slipped past the first version of this guard precisely because
    `listing-stats.ts` calls `.clear()` inside `resetListingStatsForTests` — a
    helper that only ever runs under vitest, so it evicts nothing in
    production. An eviction path that exists solely for tests is not a bound. */
function stripTestResetHelpers(src: string): string {
  const pattern = /(?:export\s+)?function\s+(?:[A-Za-z0-9_$]*ForTests|reset[A-Za-z0-9_$]*|clear[A-Za-z0-9_$]*)\s*\([^)]*\)[^{]*\{/g;
  let out = "";
  let cursor = 0;
  for (const match of src.matchAll(pattern)) {
    const bodyStart = (match.index ?? 0) + match[0].length;
    let depth = 1;
    let i = bodyStart;
    while (i < src.length && depth > 0) {
      if (src[i] === "{") depth += 1;
      else if (src[i] === "}") depth -= 1;
      i += 1;
    }
    out += src.slice(cursor, match.index ?? 0);
    cursor = i;
  }
  return out + src.slice(cursor);
}

type Offender = { file: string; name: string; line: number };

function scan(): Offender[] {
  const offenders: Offender[] = [];
  for (const root of SCAN_ROOTS) {
    for (const file of walk(join(repoRoot, root))) {
      const src = readFileSync(file, "utf8");
      const evictable = stripTestResetHelpers(src);
      const usesHelper = /\bBoundedWindowMap\b/.test(evictable);
      for (const decl of moduleLevelDeclarations(src)) {
        const name = decl.name;
        // Never written at runtime => static table, size fixed by the source.
        if (!new RegExp(`\\b${name}\\.(set|add)\\(`).test(evictable)) continue;
        if (new RegExp(`\\b${name}\\.(delete|clear)\\(`).test(evictable)) continue;
        // Eviction delegated to a local helper, e.g. evictOldestEntries(statsByListing, …)
        if (new RegExp(`\\b[A-Za-z0-9_$]*[Ee]vict[A-Za-z0-9_$]*\\(\\s*${name}\\b`).test(evictable)) continue;
        if (usesHelper) continue;
        const offset = src.split("\n").slice(0, decl.line - 1).join("\n").length;
        const window = src.slice(Math.max(0, offset - MARKER_WINDOW), offset);
        if (MARKER.test(window)) continue;
        offenders.push({ file: relative(repoRoot, file), name, line: decl.line });
      }
    }
  }
  return offenders;
}

describe("unbounded in-process state guard (BUG-R4-001/002/003 class)", () => {
  const offenders = scan();

  it("every runtime-mutated module-level Map/Set has a bounded lifecycle", () => {
    expect(
      offenders,
      offenders
        .map((o) => `${o.file}:${o.line} — \`${o.name}\` is written at runtime but has no eviction path and no \`bounded-state:\` marker`)
        .join("\n"),
    ).toEqual([]);
  });

  /* Sanity check on the guard itself: it must actually be looking at files, and
     it must still be able to see the three modules this class came from. A scan
     that silently matches nothing would pass forever. */
  it("the scan sees the modules this defect class came from", () => {
    const files = new Set<string>();
    for (const root of SCAN_ROOTS) for (const file of walk(join(repoRoot, root))) files.add(relative(repoRoot, file));
    // 259 non-test .ts files across the three roots at the time of writing.
    expect(files.size).toBeGreaterThan(250);
    for (const expected of [
      "src/lib/auth/login-throttle.ts",
      "src/lib/auth/request-safety.ts",
      "src/lib/observability/metrics-store.ts",
    ]) {
      expect(files.has(expected), `${expected} missing from scan`).toBe(true);
    }
  });

  it("the two rate-limit stores use the shared BoundedWindowMap", () => {
    for (const file of ["src/lib/auth/login-throttle.ts", "src/lib/auth/request-safety.ts"]) {
      const src = readFileSync(join(repoRoot, file), "utf8");
      expect(src, `${file} must use BoundedWindowMap`).toMatch(/\bBoundedWindowMap\b/);
    }
  });
});
