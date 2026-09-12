import assert from "node:assert/strict";
import fs from "node:fs";
import { globSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { CHECKS, dbValidateCheck, docsIndexCheck, formatSummary, runChecks, selectChecks } from "./verify.mjs";

const REPO_ROOT = path.resolve(import.meta.dirname, "../..");

/** Every *.test.mjs under a directory, as repo-relative POSIX paths. */
function walkTests(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkTests(absolute));
    else if (entry.isFile() && entry.name.endsWith(".test.mjs")) {
      out.push(path.relative(REPO_ROOT, absolute).split(path.sep).join("/"));
    }
  }
  return out;
}

test("the ops:test glob reaches every ops test file on disk", () => {
  // Guards a silent failure: unquoted, `sh` expands `**` as `*`, so a test file
  // directly under ops/scripts is skipped and the count just quietly drops.
  // The glob in package.json must stay quoted so Node does the matching.
  const pkg = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "package.json"), "utf8"));
  const script = pkg.scripts["ops:test"];
  assert.match(script, /node --test "ops\/scripts\/\*\*\/\*\.test\.mjs"/, "ops:test glob must be quoted");

  const viaGlob = globSync("ops/scripts/**/*.test.mjs", { cwd: REPO_ROOT }).sort();
  const viaDisk = walkTests(path.join(REPO_ROOT, "ops/scripts")).sort();
  assert.deepEqual(viaGlob, viaDisk);
  assert.equal(viaDisk.length > 0, true);
});

test("every ops test file is reachable from the repo root as a relative path", () => {
  for (const file of walkTests(path.join(REPO_ROOT, "ops/scripts"))) {
    assert.equal(file.startsWith("ops/scripts/"), true, `${file} should be repo-relative`);
    assert.equal(file.endsWith(".test.mjs"), true);
  }
});

test("the default gate covers what CI enforces, not just what `pnpm quality` does", () => {
  const names = CHECKS.map((check) => check.name);
  // `pnpm quality` is check + lint + test + db:validate. These are the gaps
  // that used to surface only as a red PR.
  for (const expected of ["ops:test", "security", "ops-audit", "release", "enablement", "provisioning", "docs-index"]) {
    assert.equal(names.includes(expected), true, `${expected} missing from the gate`);
  }
  // Browser/build checks belong to CI, not here.
  for (const excluded of ["build", "test:e2e", "test:perf", "test:a11y"]) {
    assert.equal(names.includes(excluded), false, `${excluded} should stay in CI only`);
  }
});

test("every check has a unique name and a reason", () => {
  const names = CHECKS.map((check) => check.name);
  assert.equal(new Set(names).size, names.length);
  for (const check of CHECKS) {
    assert.equal(typeof check.why, "string");
    assert.equal(check.why.length > 0, true, `${check.name} has no why`);
    assert.equal(Boolean(check.command) || Boolean(check.special), true, `${check.name} has nothing to run`);
  }
});

test("--quick narrows to the fast subset", () => {
  const { checks } = selectChecks(["--quick"]);
  assert.deepEqual(checks.map((check) => check.name), ["check", "lint", "ops:test", "test"]);
  assert.equal(selectChecks([]).checks.length, CHECKS.length);
});

test("--only selects by name and rejects unknown names", () => {
  assert.deepEqual(selectChecks(["--only", "lint,docs-index"]).checks.map((c) => c.name), ["lint", "docs-index"]);
  const bad = selectChecks(["--only", "lint,nonexistent"]);
  assert.deepEqual(bad.checks, []);
  assert.match(bad.error, /unknown check\(s\): nonexistent/);
});

test("runChecks keeps going after a failure instead of stopping at the first", () => {
  const ran = [];
  const results = runChecks({
    checks: [
      { name: "fails-first", command: "false-cmd", args: [], why: "x" },
      { name: "passes", command: "true-cmd", args: [], why: "x" },
      { name: "also-fails", command: "false-cmd", args: [], why: "x" },
    ],
    run: (command) => {
      ran.push(command);
      return command === "true-cmd" ? 0 : 1;
    },
  });
  assert.deepEqual(ran, ["false-cmd", "true-cmd", "false-cmd"]);
  assert.deepEqual(results.map((r) => [r.name, r.status]), [["fails-first", 1], ["passes", 0], ["also-fails", 1]]);
});

test("docs-index reports current vs stale and says to commit when it fixes it", () => {
  const current = docsIndexCheck({ run: (command, args) => (command === "git" ? 0 : 0) });
  assert.deepEqual(current, { status: 0, note: "already current" });

  const stale = docsIndexCheck({ run: (command) => (command === "git" ? 1 : 0) });
  assert.equal(stale.status, 1);
  assert.match(stale.note, /was stale/);
  assert.match(stale.note, /commit it/);
});

test("docs-index runs the generator before diffing", () => {
  const calls = [];
  docsIndexCheck({
    run: (command, args) => {
      calls.push([command, ...args].join(" "));
      return 0;
    },
  });
  assert.equal(calls[0], "node ops/scripts/generate-md-index.mjs");
  assert.match(calls[1], /^git diff --exit-code -- docs\/MARKDOWN-DOCUMENTATION-INDEX\.md$/);
});

test("db:validate falls back to the offline shim instead of reporting a network error as a schema failure", () => {
  // Online path works: no fallback, no note.
  const online = dbValidateCheck({ run: () => 0 });
  assert.deepEqual(online, { status: 0, note: "" });

  // Online blocked, offline works: pass, but say which path was used.
  const calls = [];
  const offline = dbValidateCheck({
    run: (command, args) => {
      calls.push(args[0]);
      return args[0] === "db:validate" ? 1 : 0;
    },
  });
  assert.equal(offline.status, 0);
  assert.match(offline.note, /offline schema-engine shim/);
  assert.deepEqual(calls, ["db:validate", "db:validate:offline"]);

  // Both fail: a real failure.
  const broken = dbValidateCheck({ run: () => 1 });
  assert.equal(broken.status, 1);
  assert.match(broken.note, /both online and offline/);
});

test("summary names exactly the failures", () => {
  const text = formatSummary([
    { name: "check", status: 0, note: "" },
    { name: "lint", status: 1, note: "" },
    { name: "docs-index", status: 1, note: "was stale" },
  ]);
  assert.match(text, /2 of 3 failed: lint, docs-index/);
  assert.match(text, /FAIL\s+lint/);
  assert.match(text, /pass\s+check/);

  const clean = formatSummary([{ name: "check", status: 0, note: "" }]);
  assert.match(clean, /all 1 passed/);
});
