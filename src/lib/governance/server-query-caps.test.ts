import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/* Perf-bug-hunt 2026-09-06 (PERF-BUG-16-001): governance list queries were
   unbounded findMany calls. The fix caps them at GOVERNANCE_LIST_PAGE_CAP.
   server.ts is server-only, so this guard asserts the contract at the source
   level: every findMany in the governance server path must carry a take cap. */

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const source = readFileSync(join(repoRoot, "src/lib/governance/server.ts"), "utf8");

describe("governance server queries stay bounded (PERF-BUG-16-001)", () => {
  it("exports a page-cap constant", () => {
    const cap = /GOVERNANCE_LIST_PAGE_CAP\s*=\s*(\d+)/.exec(source);
    expect(cap, "GOVERNANCE_LIST_PAGE_CAP export").toBeTruthy();
    expect(Number(cap![1])).toBeGreaterThan(0);
  });

  it("every findMany call in governance/server.ts passes a take cap", () => {
    // Match findMany({ ... }) allowing one level of nested braces (e.g. orderBy: { ... }).
    const calls = [...source.matchAll(/findMany\(\s*\{(?:[^{}]|\{[^{}]*\})*\}\s*\)/gs)].map((m) => m[0]);
    expect(calls.length).toBeGreaterThanOrEqual(3);
    for (const call of calls) {
      expect(call, `unbounded findMany: ${call.slice(0, 80)}`).toMatch(/take:\s*GOVERNANCE_LIST_PAGE_CAP/);
    }
  });
});
