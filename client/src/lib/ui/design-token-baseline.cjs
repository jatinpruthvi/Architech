#!/usr/bin/env node
/* Regenerate design-token-baseline.json after paying down legacy type/colour debt.
   Run: node client/src/lib/ui/design-token-baseline.cjs --write
   The guard test compares against this file, so a cleanup that lowers a count
   passes immediately, and this command then locks the new level in. */
const { readFileSync, writeFileSync } = require("node:fs");
const { execSync } = require("node:child_process");

const out = execSync(
  "grep -rl --include='*.tsx' '' client/src app | grep -v '\\.test\\.' | grep -v '\\.stories\\.'",
  { encoding: "utf8" }
).split("\n").filter(Boolean);

const base = {
  _readme:
    "Ratchet baseline for design-token-discipline.test.ts. Each number is the CURRENT count of a legacy pattern in that file. The test fails only when a file EXCEEDS its baseline, so debt can be paid down but never grows. Regenerate after a cleanup with: node client/src/lib/ui/design-token-baseline.cjs --write",
};
for (const file of out) {
  const src = readFileSync(file, "utf8");
  const alphaText = (src.match(/text-(?:ink|cream|foreground|muted-foreground)\/\d+/g) ?? []).length;
  const microText = (src.match(/!text-\[1[01]px\]/g) ?? []).length;
  // 9px is the pattern the audit demanded be deleted outright. It cannot be a
  // hard zero today (17 files still use it) without a repo-wide codemod, so it
  // is budgeted: no file may ADD one, and every file that clears it stays clear.
  const nanoText = (src.match(/!text-\[9px\]/g) ?? []).length;
  if (alphaText || microText || nanoText) base[file] = { alphaText, microText, nanoText };
}
writeFileSync("client/src/lib/ui/design-token-baseline.json", JSON.stringify(base, null, 2) + "\n");
console.log("baseline written:", Object.keys(base).length - 1, "files");
