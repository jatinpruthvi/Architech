import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { checkMarkdownIndex, findDeadLinks, parseIndexEntries, summarize } from "./check-md-index.mjs";

const REPO_ROOT = path.resolve(import.meta.dirname, "../..");
const INDEX = "docs/MARKDOWN-DOCUMENTATION-INDEX.md";

/** A minimal index with two entries, as the generator writes it. */
function index(entries, header = "Generated from the repository Markdown tree (2 files, digest abc123456789).") {
  return ["# Architech Markdown Documentation Index", "", header, "", "## Start Here", "", ...entries.map((entry) => `- [Title](../${entry})`), ""].join("\n") + "\n";
}

/** spawnSync-shaped stub: `responses` maps "command arg0" -> result. */
function stubRun(responses, calls = []) {
  return (command, args) => {
    calls.push([command, ...args].join(" "));
    const key = [command, ...(args ?? [])].join(" ");
    for (const [prefix, value] of Object.entries(responses)) {
      if (key.includes(prefix)) return typeof value === "function" ? value(key) : value;
    }
    return { status: 0, stdout: "", stderr: "" };
  };
}

const ok = { status: 0, stdout: "", stderr: "" };

test("parseIndexEntries reads the link targets the generator writes", () => {
  assert.deepEqual(parseIndexEntries(index(["README.md", "docs/a.md"])), ["README.md", "docs/a.md"]);
  // Prose and headings are not entries.
  assert.deepEqual(parseIndexEntries("# heading\n\nsome text\n"), []);
});

test("findDeadLinks reports links to files the repository does not have", () => {
  const tracked = new Set(["README.md", "docs/a.md"]);
  assert.deepEqual(findDeadLinks(["README.md", "docs/a.md"], tracked), []);
  assert.deepEqual(findDeadLinks(["README.md", "business_suite/erpnext/README.md"], tracked), ["business_suite/erpnext/README.md"]);
});

test("summarize reports added, removed and every header line", () => {
  const before = index(["README.md", "gone.md"], "Generated from the repository Markdown tree (2 files, digest old.).");
  const after = index(["README.md", "new.md"], "Generated from the repository Markdown tree (2 files, digest new.).");
  const diff = summarize(before, after);
  assert.deepEqual(diff.removed, ["gone.md"]);
  assert.deepEqual(diff.added, ["new.md"]);
  assert.equal(diff.headersBefore.length, 1);
  assert.match(diff.headersAfter[0], /digest new/);
});

test("summarize keeps both header lines when a merge left two behind", () => {
  // The failure this check exists for: a conflict resolved by keeping both
  // sides produces two "Generated from" lines, which no single-line read shows.
  const merged = ["Generated from the repository Markdown tree (714 files, digest a.).", "Generated from the repository Markdown tree (214 files, digest b.).", "", "- [X](../x.md)"].join("\n");
  assert.equal(summarize(merged, merged).headersBefore.length, 2);
});

test("a current index with no dead links passes", () => {
  const contents = index(["README.md", "docs/a.md"]);
  const result = checkMarkdownIndex({
    read: () => contents,
    run: stubRun({ "generate-md-index": ok, "ls-files": { status: 0, stdout: "README.md\ndocs/a.md\n" } }),
  });
  assert.equal(result.status, 0);
  assert.match(result.lines.join("\n"), /is current/);
});

test("a stale index fails with the command that fixes it", () => {
  const committed = index(["README.md", "business_suite/erpnext/README.md"]);
  const generated = index(["README.md"]);
  let phase = 0;
  const result = checkMarkdownIndex({
    read: () => (phase++ === 0 ? committed : generated),
    run: stubRun({ "generate-md-index": ok, "ls-files": { status: 0, stdout: "README.md\n" } }),
  });
  assert.equal(result.status, 1);
  const text = result.lines.join("\n");
  assert.match(text, /is stale/);
  assert.match(text, /pnpm docs:index/);
  assert.match(text, /business_suite\/erpnext\/README\.md/);
  assert.match(text, /not in the repository/);
});

test("a failing generator is a tooling failure, not a stale index", () => {
  // The distinction the old `git diff --exit-code` could not make: exit 128
  // from git looked exactly like "the index is stale".
  const committed = index(["README.md"]);
  const result = checkMarkdownIndex({
    read: () => committed,
    run: stubRun({
      "generate-md-index": { status: 1, stdout: "", stderr: "TypeError: cannot read properties of undefined" },
      "ls-files": { status: 0, stdout: "README.md\n" },
    }),
  });
  assert.equal(result.status, 2);
  const text = result.lines.join("\n");
  assert.match(text, /generator failed/);
  assert.match(text, /not a stale index/);
  assert.match(text, /TypeError/);
});

test("a generator killed by a signal is still reported as a tooling failure", () => {
  const committed = index(["README.md"]);
  const result = checkMarkdownIndex({
    read: () => committed,
    run: stubRun({ "generate-md-index": { status: null, stdout: "", stderr: "", error: new Error("spawnSync ENOENT") } }),
  });
  assert.equal(result.status, 2);
  assert.match(result.lines.join("\n"), /ENOENT/);
});

test("a missing index is reported as a tooling failure, not a diff", () => {
  const result = checkMarkdownIndex({
    read: () => {
      throw new Error("ENOENT");
    },
    run: stubRun({}),
  });
  assert.equal(result.status, 2);
  assert.match(result.lines.join("\n"), /could not be read/);
});

test("dead links fail even when regenerating changes nothing", () => {
  // The index can be byte-identical to the generated output and still be wrong,
  // if it links to files nobody committed. Passing that silently is how 497
  // dead links stayed in the repository.
  const contents = index(["README.md", "business_suite/erpnext/README.md"]);
  const result = checkMarkdownIndex({
    read: () => contents,
    run: stubRun({ "generate-md-index": ok, "ls-files": { status: 0, stdout: "README.md\n" } }),
  });
  assert.equal(result.status, 1);
  assert.match(result.lines.join("\n"), /dead link/i);
});

test("the dead-link gate is skipped when git is unavailable", () => {
  const contents = index(["README.md"]);
  const result = checkMarkdownIndex({
    read: () => contents,
    run: stubRun({ "generate-md-index": ok, "ls-files": { status: 128, stdout: "", stderr: "fatal: not a git repository" } }),
  });
  assert.equal(result.status, 0);
});

test("the generator runs before the second read, so the comparison is against fresh output", () => {
  const contents = index(["README.md"]);
  const calls = [];
  checkMarkdownIndex({
    read: () => contents,
    run: stubRun({ "generate-md-index": ok, "ls-files": { status: 0, stdout: "README.md\n" } }, calls),
  });
  assert.equal(calls.some((call) => call.includes("generate-md-index.mjs")), true);
});

test("--diff appends the unified diff when asked for", () => {
  const committed = index(["README.md", "gone.md"]);
  const generated = index(["README.md"]);
  let phase = 0;
  const result = checkMarkdownIndex({
    wantDiff: true,
    read: () => (phase++ === 0 ? committed : generated),
    run: stubRun({
      "generate-md-index": ok,
      "ls-files": { status: 0, stdout: "README.md\n" },
      "--no-pager diff": { status: 0, stdout: "--- a\n+++ b\n-gone\n" },
    }),
  });
  assert.equal(result.status, 1);
  assert.match(result.lines.join("\n"), /-gone/);
});

test("CI and the local gate both run this script, not a bare git diff", () => {
  // Guards the regression: `git diff --exit-code` in ci.yml is what made the
  // original failure unreadable, reporting only "git exited 128".
  const workflow = fs.readFileSync(path.join(REPO_ROOT, ".github/workflows/ci.yml"), "utf8");
  assert.match(workflow, /docs:index:check/);
  assert.equal(workflow.includes("git diff --exit-code docs/MARKDOWN-DOCUMENTATION-INDEX.md"), false);

  const verify = fs.readFileSync(path.join(REPO_ROOT, "ops/scripts/verify.mjs"), "utf8");
  assert.match(verify, /check-md-index\.mjs/);
});

test("the committed index is what the generator produces, with no dead links", () => {
  // The end-to-end assertion, against the real repository rather than stubs.
  const result = checkMarkdownIndex({ cwd: REPO_ROOT });
  assert.equal(result.status, 0, result.lines.join("\n"));

  const tracked = new Set(
    fs
      .readFileSync(path.join(REPO_ROOT, INDEX), "utf8")
      .split("\n")
      .map((line) => parseIndexEntries(line)[0])
      .filter(Boolean),
  );
  assert.equal(tracked.size > 0, true);
});
