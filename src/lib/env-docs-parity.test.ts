import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/* Bug-hunt round 2 (BUG-R2-001, 6 Sep 2026): a NEXT_PUBLIC_* variable was used
   in code without being documented in .env.example. This guard codifies the
   contract both directions:
   - every NEXT_PUBLIC_* referenced in app/, src/, next.config.ts must be
     documented in .env.example (operators must be able to discover it), and
   - every NEXT_PUBLIC_* documented must still be referenced (no stale rows). */

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

function* walk(dir: string): Generator<string> {
  if (!statSync(dir, { throwIfNoEntry: false })?.isDirectory()) return;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(p);
    else if (/\.(ts|tsx)$/.test(entry.name)) yield p;
  }
}

const ENV_TOKEN = /NEXT_PUBLIC_[A-Z0-9_]+/g;

function usedTokens(): Set<string> {
  const tokens = new Set<string>();
  const files = [...walk(join(repoRoot, "src/app")), ...walk(join(repoRoot, "src"))];
  files.push(join(repoRoot, "next.config.ts"));
  for (const file of files) {
    for (const match of readFileSync(file, "utf8").matchAll(ENV_TOKEN)) tokens.add(match[0]);
  }
  return tokens;
}

function documentedTokens(): Set<string> {
  const example = readFileSync(join(repoRoot, ".env.example"), "utf8");
  return new Set([...example.matchAll(ENV_TOKEN)].map((m) => m[0]));
}

describe("NEXT_PUBLIC_* env documentation parity (.env.example)", () => {
  it("documents every variable the code references", () => {
    const undocumented = [...usedTokens()].filter((t) => !documentedTokens().has(t));
    expect(undocumented).toEqual([]);
  });

  it("has no stale documented variables the code no longer references", () => {
    const stale = [...documentedTokens()].filter((t) => !usedTokens().has(t));
    expect(stale).toEqual([]);
  });
});
