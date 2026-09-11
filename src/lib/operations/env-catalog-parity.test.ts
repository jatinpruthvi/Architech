import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { validateEnvCatalog } from "./hygiene";

/* Bug-hunt round 4, W5 — `validateEnvCatalog` was a dormant control. Its only
   caller in the whole tree was its own unit test, and 18 keys that the codebase
   actually reads were absent from ALLOWED_ENV_KEYS, so the function would have
   reported the project's own configuration as unknown had anyone wired it up.

   This test makes the control live: on every CI run it scans the source for
   `process.env` reads and drives them through the real validator, in both
   directions.

     A. every key READ in code must be in the allow-list  (validateEnvCatalog)
     B. every key in the allow-list must be REFERENCED somewhere (source or
        .env.example), so the catalog cannot silently rot

   Direction B accepts a bare textual reference, not just `process.env.X`,
   because several keys reach the code through an injected env object
   (`this.env.R2_BUCKET` in media/provider.ts) or a required-keys array
   (`media/source.ts:8`) rather than a direct property read.

   Test files are excluded from direction A: they set fixture environment
   variables that are deliberately not part of the product's configuration
   surface. */

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const SCAN_ROOTS = ["src/app", "src", "src/shared", "ops/scripts"];

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!/node_modules|\.next/.test(entry.name)) walk(full, out);
    } else if (/\.(ts|tsx|mjs|cjs)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

function sourceFiles(): { path: string; body: string }[] {
  const files: { path: string; body: string }[] = [];
  for (const root of SCAN_ROOTS) {
    for (const file of walk(join(repoRoot, root))) {
      if (file.includes(".test.")) continue;
      files.push({ path: relative(repoRoot, file), body: readFileSync(file, "utf8") });
    }
  }
  // Config files live at the repo root and read env at build/startup.
  for (const file of ["next.config.ts", "proxy.ts", "instrumentation.ts", "sentry.server.config.ts"]) {
    try {
      files.push({ path: file, body: readFileSync(join(repoRoot, file), "utf8") });
    } catch {
      /* optional file */
    }
  }
  return files;
}

function keysReadInCode(files: { body: string }[]): string[] {
  const keys = new Set<string>();
  for (const file of files) {
    for (const match of file.body.matchAll(/process\.env\.([A-Z][A-Z0-9_]+)/g)) keys.add(match[1]);
    for (const match of file.body.matchAll(/process\.env\[\s*['"]([A-Z][A-Z0-9_]+)['"]/g)) keys.add(match[1]);
  }
  return [...keys].sort();
}

describe("env catalog parity (W5 — validateEnvCatalog is now enforced)", () => {
  const files = sourceFiles();
  const readKeys = keysReadInCode(files);

  it("direction A: every process.env key read in code is in the allow-list", () => {
    const result = validateEnvCatalog(Object.fromEntries(readKeys.map((key) => [key, "set"])));
    expect(result.issues, result.issues.join("\n")).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it("direction B: every allow-listed key is referenced somewhere in the repo", () => {
    const haystack = files.map((file) => file.body).join("\n") + "\n" + readFileSync(join(repoRoot, ".env.example"), "utf8");
    const stale = validateEnvCatalog({}).allowedEnvKeys.filter((key) => !new RegExp(`\\b${key}\\b`).test(haystack));
    expect(stale, `allow-listed but referenced nowhere: ${stale.join(", ")}`).toEqual([]);
  });

  /* The validator must actually reject an unknown key, or direction A passes
     vacuously. */
  it("validateEnvCatalog rejects a key that is not allow-listed", () => {
    const result = validateEnvCatalog({ ARCHITECH_DEFINITELY_NOT_A_REAL_KEY: "x" });
    expect(result.ok).toBe(false);
    expect(result.issues.join(" ")).toContain("ARCHITECH_DEFINITELY_NOT_A_REAL_KEY");
  });

  it("the scan is actually reading source", () => {
    expect(files.length).toBeGreaterThan(250);
    expect(readKeys.length).toBeGreaterThan(40);
    expect(readKeys).toContain("DATABASE_URL");
  });
});
