import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

// setup-local-db.mjs calls main() at import time, so these are source-level
// assertions rather than an import of the module. That is the point: they check
// the script's assumptions about the repository layout without provisioning a
// database to find out.
const here = import.meta.dirname;
const repoRoot = path.resolve(here, "../../..");
const source = fs.readFileSync(path.join(here, "setup-local-db.mjs"), "utf8");

test("the schema-engine shim sits next to the script that installs it", () => {
  assert.equal(fs.existsSync(path.join(here, "schema-engine-shim.cjs")), true);
});

test("setup-local-db resolves the shim relative to itself, not to a repo-root literal", () => {
  // The scripts/ -> ops/scripts/ restructure left `path.join(repoRoot,
  // "scripts", "sandbox", ...)` behind. `pnpm db:setup:sandbox` then died with
  // ENOENT at the shim install — on precisely the network-restricted machines
  // the script exists to serve, which is also the only situation that reaches
  // that line. A sibling-relative path cannot go stale when the folder moves.
  assert.match(source, /const SHIM_SRC = path\.join\(here, "schema-engine-shim\.cjs"\)/);
  assert.equal(/path\.join\(\s*repoRoot,\s*"scripts"/.test(source), false, "repo-root-relative scripts/ literal is back");
});

test("no path literal in the script points at the pre-restructure scripts/ tree", () => {
  // Comments may mention ops/scripts/; a quoted bare "scripts" segment may not.
  const stale = source
    .split("\n")
    .map((line, index) => ({ line: index + 1, text: line }))
    .filter(({ text }) => /^\s*[^/*]/.test(text))
    .filter(({ text }) => /"scripts"/.test(text));
  assert.deepEqual(stale, []);
});

test("every repository path the script depends on still exists", () => {
  // These are the assumptions that break silently when the tree is rearranged:
  // each one turns into a runtime ENOENT only on the code path that needs it.
  for (const relative of ["db/seed.mjs", "db/migrations", ".env.example", "ops/scripts/sandbox/schema-engine-shim.cjs", "package.json"]) {
    assert.equal(fs.existsSync(path.join(repoRoot, relative)), true, `${relative} is missing`);
  }
});

test("the docstring and the code agree on where the shim lives", () => {
  // The header always said ops/scripts/sandbox/schema-engine-shim.cjs; the code
  // disagreed. Keeping them matched means the next reader is not misled.
  assert.match(source, /installs ops\/scripts\/sandbox\/\n? \*?\s*schema-engine-shim\.cjs/);
});
