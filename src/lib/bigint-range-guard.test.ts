import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

/* Bug-hunt round 4, §6 item 3 — CI source guard for the convert-before-validate
   class: BUG-R4-005 (requirement/channel amounts), BUG-R4-006 (commission
   split), and the earlier BUG-2026-001 and BUG-R3-001 in rounds 1 and 3. Four
   occurrences of one mistake.

   The mistake: a validator checks the SIGN and the PRESENCE of a number while
   the writer converts the raw input with `BigInt(Math.round(Number(x)))`.
   JavaScript BigInt is arbitrary-precision, so the conversion never fails — the
   failure happens one layer later, in PostgreSQL, as 22003
   numeric_value_out_of_range against an INTEGER/BIGINT column. Unhandled, it is
   a 500.

   Rule: any module containing a real `BigInt(` conversion must also carry
   evidence of a ceiling — one of the project's declared bounds (MAX_INR,
   MAX_SAFE_INR, MAX_STORED_INT, Number.MAX_SAFE_INTEGER) or an explicit
   `bigint-range: <reason>` marker naming the validator that bounds the value.

   Source-level scan, following sql-query-bounds.test.ts. Comments are stripped
   first: prose about `BigInt(` (this report and several code comments discuss
   it) must not be counted as a conversion site. */

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SCAN_ROOTS = ["src", "src/app", "src/shared"];
const MARKER = /bigint-range:/;
const CEILING_TOKENS = ["MAX_INR", "MAX_SAFE_INR", "MAX_STORED_INT", "Number.MAX_SAFE_INTEGER"];

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

/** Remove block and line comments so prose is not mistaken for code. Naive but
    adequate here: no string literal in this codebase contains `//` or `/*`. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

type Offender = { file: string; conversions: number };

function scan(): Offender[] {
  const offenders: Offender[] = [];
  for (const root of SCAN_ROOTS) {
    for (const file of walk(join(repoRoot, root))) {
      const raw = readFileSync(file, "utf8");
      const code = stripComments(raw);
      const conversions = (code.match(/\bBigInt\s*\(/g) ?? []).length;
      if (conversions === 0) continue;
      if (MARKER.test(raw)) continue;
      if (CEILING_TOKENS.some((token) => code.includes(token))) continue;
      offenders.push({ file: relative(repoRoot, file), conversions });
    }
  }
  return offenders;
}

describe("BigInt range guard (BUG-R4-005/006 class)", () => {
  const offenders = scan();

  it("every module converting to BigInt carries a range ceiling", () => {
    expect(
      offenders,
      offenders
        .map((o) => `${o.file} — ${o.conversions} BigInt( conversion(s) with no MAX_INR/MAX_SAFE_INR/MAX_STORED_INT ceiling and no \`bigint-range:\` marker`)
        .join("\n"),
    ).toEqual([]);
  });

  /* The guard must actually be finding conversion sites. A scan that matched
     nothing would pass forever while the class regressed unnoticed. */
  it("the scan finds the known conversion sites", () => {
    const withConversions = new Set<string>();
    for (const root of SCAN_ROOTS) {
      for (const file of walk(join(repoRoot, root))) {
        if (/\bBigInt\s*\(/.test(stripComments(readFileSync(file, "utf8")))) {
          withConversions.add(relative(repoRoot, file));
        }
      }
    }
    /* Three modules hold real `BigInt(` conversions today. broker-store.ts is
       deliberately absent: it goes through money.ts's toInrBigInt, which is the
       preferred shape — the guard's \b boundary correctly does not match it. */
    for (const expected of [
      "src/lib/money.ts",
      "src/lib/persistence/channel-store.ts",
      "src/lib/requirements.server.ts",
    ]) {
      expect(withConversions.has(expected), `${expected} should be detected`).toBe(true);
    }
  });

  /* The two validators that BUG-R4-005/006 fixed must keep their ceilings. This
     is the direct regression pin on the fix itself, independent of the scan. */
  it("the requirement and channel validators declare their ceilings", () => {
    for (const file of ["src/lib/requirements.ts", "src/lib/broker/channel.ts"]) {
      const src = readFileSync(join(repoRoot, file), "utf8");
      expect(src, `${file} lost MAX_STORED_INT`).toMatch(/MAX_STORED_INT\s*=\s*2_147_483_647/);
      expect(src, `${file} lost MAX_INR`).toMatch(/MAX_INR\s*=\s*Number\.MAX_SAFE_INTEGER/);
    }
  });
});
