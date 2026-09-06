import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

/* ARCH-17 hunt guard (SQL-PERF-17 class). Every prisma `findMany` in the
   codebase must be BOUNDED: either it passes `take:` (page cap, cursor
   batch, or explicit limit — precedents: GOVERNANCE_LIST_PAGE_CAP,
   BROKER_LIST_PAGE_CAP, LEAD_INBOX_PAGE_CAP, BROKER_CHANNEL_LIST_PAGE_CAP,
   MEDIA_RETENTION_SCAN_BATCH) or it carries an explicit
   `sql-perf: intentionally-unbounded` marker in the 500 characters before
   the call, stating why a cap would be wrong (correctness surfaces:
   publish gates, directories, reference registries, build-time id maps,
   caller-bounded in: reads).
   Source-level scan because most data-layer modules import "server-only"
   and cannot be imported under plain vitest (precedent:
   client/src/lib/governance/server-query-caps.test.ts).
   Balanced-brace extraction (not regex), because one-level regex nesting
   matched neither two-level include/select trees nor multi-line args —
   both caused false census results during the 2026-09-06 hunt. */

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const SCAN_ROOTS = ["client/src", "app", "shared"];
const MARKER = /sql-perf:\s*intentionally-unbounded/;
const MARKER_WINDOW = 500;

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

/** Slice the balanced argument list starting at the "(" after .findMany. */
function extractBalanced(src: string, openParenIdx: number): string | null {
  let depth = 0;
  for (let i = openParenIdx; i < src.length; i += 1) {
    const c = src[i];
    if (c === "(" || c === "{" || c === "[") depth += 1;
    else if (c === ")" || c === "}" || c === "]") {
      depth -= 1;
      if (depth === 0) return src.slice(openParenIdx, i + 1);
    }
  }
  return null;
}

type Finding = { file: string; line: number; args: string | null; marked: boolean };

function findingsIn(src: string, file: string): Finding[] {
  const out: Finding[] = [];
  let idx = 0;
  while ((idx = src.indexOf(".findMany(", idx)) !== -1) {
    const openParen = idx + ".findMany".length;
    const args = extractBalanced(src, openParen);
    const before = src.slice(Math.max(0, idx - MARKER_WINDOW), idx);
    out.push({
      file,
      line: src.slice(0, idx).split("\n").length,
      args,
      marked: MARKER.test(before),
    });
    idx += ".findMany".length;
  }
  return out;
}

describe("SQL query bounds (ARCH-17 guard against unbounded findMany)", () => {
  const files = SCAN_ROOTS.flatMap((root) => {
    const abs = join(repoRoot, root);
    try {
      return walk(abs);
    } catch {
      return [];
    }
  });
  const all = files.flatMap((file) => findingsIn(readFileSync(file, "utf8"), relative(repoRoot, file)));

  it("discovers the query surface (sanity: degenerate scans must fail)", () => {
    // Census on 2026-09-06: 33 findMany call sites. A scanner regression
    // that stops seeing them must fail, not pass vacuously.
    expect(all.length).toBeGreaterThanOrEqual(30);
  });

  it("every findMany is bounded by take: or an explicit intentional-unbounded marker", () => {
    const unbounded = all.filter((f) => !f.marked && !(f.args && /take\s*:/.test(f.args)));
    expect(
      unbounded.map((f) => `${f.file}:${f.line}`).join("\n") || "none",
    ).toBe("none");
  });
});
