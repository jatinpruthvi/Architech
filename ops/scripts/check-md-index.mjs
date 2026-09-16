#!/usr/bin/env node
/**
 * Fail when docs/MARKDOWN-DOCUMENTATION-INDEX.md is not what the generator
 * would produce right now, and say *why* in terms a human can act on.
 *
 *   pnpm docs:index:check            # gate used by CI and `pnpm verify`
 *   pnpm docs:index:check -- --diff  # also print the full unified diff
 *
 * WHY THIS EXISTS INSTEAD OF `git diff --exit-code`
 *
 * CI used to run:
 *
 *   node ops/scripts/generate-md-index.mjs
 *   git diff --exit-code docs/MARKDOWN-DOCUMENTATION-INDEX.md
 *
 * That conflates two very different outcomes into one opaque non-zero exit: a
 * stale index and a git failure ("fatal: …", exit 128) are indistinguishable,
 * and the only output is a raw diff with no instruction. This step went red on
 * four consecutive commits and nothing in the log said why — the real cause, an
 * index committed from a machine whose submodule checkouts were populated, had
 * to be reconstructed by hand.
 *
 * (Separately: CI carries a permanent *warning* annotation, "The process
 * '/usr/bin/git' failed with exit code 128", on every run including green ones.
 * It predates this and does not fail any step. See the submodule note in
 * ops/scripts/AGENTS.md before chasing it.)
 *
 * This script separates them:
 *   exit 0  index is current
 *   exit 1  index is stale (a content problem — regenerate and commit)
 *   exit 2  the check itself could not run (a tooling problem — not staleness)
 *
 * It also verifies every link in the committed index resolves to a file that
 * exists in the repository. That is a real correctness gate, not cosmetics:
 * the stale index carried 497 links to files that were never committed, and no
 * other check in the pipeline reads documentation links.
 *
 * Stdlib-only, per ops/scripts/AGENTS.md.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const INDEX = "docs/MARKDOWN-DOCUMENTATION-INDEX.md";
const GENERATOR = "ops/scripts/generate-md-index.mjs";
/** How many added/removed entries to list before truncating. */
const SHOW = 15;

/** `- [Title](../relative/path.md)` -> `relative/path.md` */
const ENTRY = /^- \[[^\]]*\]\(\.\.\/(?<target>[^)]+)\)$/;

/** Every documentation path the index links to, in order. */
export function parseIndexEntries(contents) {
  return contents
    .split("\n")
    .map((line) => ENTRY.exec(line)?.groups?.target)
    .filter((target) => typeof target === "string");
}

/** Which files exist in the repository, according to git. */
export function listTrackedFiles({ cwd, run = spawnSync }) {
  const result = run("git", ["ls-files", "--cached"], { cwd, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (result.error || result.status !== 0) return null;
  return new Set(result.stdout.split("\n").filter(Boolean));
}

/** Links pointing at files the repository does not contain. */
export function findDeadLinks(entries, tracked) {
  return entries.filter((entry) => !tracked.has(entry));
}

/** A short, ordered description of how two index versions differ. */
export function summarize(before, after) {
  const beforeEntries = parseIndexEntries(before);
  const afterEntries = parseIndexEntries(after);
  const beforeSet = new Set(beforeEntries);
  const afterSet = new Set(afterEntries);
  const removed = beforeEntries.filter((entry) => !afterSet.has(entry));
  const added = afterEntries.filter((entry) => !beforeSet.has(entry));
  // Every header line, not just the first: a committed file carrying two of
  // them is a merge that kept both sides, which is worth saying out loud.
  const headersBefore = before.split("\n").filter((line) => line.startsWith("Generated from"));
  const headersAfter = after.split("\n").filter((line) => line.startsWith("Generated from"));
  return { added, removed, headersBefore, headersAfter, beforeCount: beforeEntries.length, afterCount: afterEntries.length };
}

function list(label, items) {
  if (items.length === 0) return [];
  const shown = items.slice(0, SHOW);
  const lines = shown.map((item) => `    ${label} ${item}`);
  if (items.length > shown.length) lines.push(`    … and ${items.length - shown.length} more`);
  return lines;
}

/**
 * Run the whole check. Injectable so the test suite can drive every branch
 * without touching the repository.
 *
 * `run(command, args, options)` must return `{ status, stdout, stderr, error }`.
 */
export function checkMarkdownIndex({ cwd = process.cwd(), run = spawnSync, read = (file) => fs.readFileSync(file, "utf8"), wantDiff = false } = {}) {
  const indexPath = path.join(cwd, INDEX);

  let committed;
  try {
    committed = read(indexPath);
  } catch {
    return {
      status: 2,
      lines: [`${INDEX} could not be read.`, `  Expected the generated index to be committed at ${INDEX}.`, `  Run \`pnpm docs:index\` and commit the result.`],
    };
  }

  // Read before generating: this is the committed content the comparison is
  // made against, and holding it means a generator failure can still be
  // reported instead of losing the "before" half of the diff.
  const generated = run(process.execPath, [GENERATOR], { cwd, encoding: "utf8" });
  if (generated.error || generated.status !== 0) {
    const detail = (generated.stderr || generated.stdout || String(generated.error || "")).trim();
    return {
      status: 2,
      lines: [
        `The index generator failed, so staleness could not be determined. This is a tooling failure, not a stale index.`,
        `  command: node ${GENERATOR}`,
        ...(detail ? detail.split("\n").map((line) => `  ${line}`) : []),
      ],
    };
  }

  let current;
  try {
    current = read(indexPath);
  } catch {
    return { status: 2, lines: [`${INDEX} disappeared while the generator ran.`] };
  }

  const tracked = listTrackedFiles({ cwd, run });
  const deadLinks = tracked ? findDeadLinks(parseIndexEntries(committed), tracked) : [];

  if (current === committed) {
    if (deadLinks.length > 0) {
      // Regenerating does not change the file, yet it still links to files the
      // repository does not have. Report it rather than passing silently.
      return {
        status: 1,
        lines: [
          `${INDEX} is up to date but contains ${deadLinks.length} link(s) to files that are not in the repository:`,
          ...list("-", deadLinks),
          "  These are dead links on GitHub. Remove the source files from the index generator's input, or commit them.",
        ],
      };
    }
    return { status: 0, lines: [`${INDEX} is current (${parseIndexEntries(committed).length} entries, no dead links).`] };
  }

  const { added, removed, headersBefore, headersAfter, beforeCount, afterCount } = summarize(committed, current);
  const lines = [
    `${INDEX} is stale — the committed copy does not match what \`pnpm docs:index\` produces.`,
    "",
    `  committed: ${beforeCount} entries`,
    `  generated: ${afterCount} entries`,
  ];
  if (headersBefore.length > 1) {
    lines.push(
      "",
      `  The committed file has ${headersBefore.length} "Generated from" lines. Only one is ever written,`,
      "  so this looks like a merge that kept both sides of a conflict.",
    );
  }
  if (headersBefore.join("\n") !== headersAfter.join("\n")) {
    lines.push("", ...headersBefore.map((line) => `  ${line.trim()}`), ...headersAfter.map((line) => `  ${line.trim()}`));
  }
  if (removed.length > 0 || added.length > 0) {
    lines.push("");
    lines.push(...list("-", removed));
    lines.push(...list("+", added));
  }
  if (deadLinks.length > 0) {
    const removedSet = new Set(removed);
    const notAlreadyListed = deadLinks.filter((link) => !removedSet.has(link));
    lines.push("", `  ${deadLinks.length} committed link(s) point at files that are not in the repository.`);
    if (notAlreadyListed.length === 0) {
      lines.push("  They are exactly the entries listed for removal above: a generated index can");
      lines.push("  only link to tracked files, so regenerating drops them.");
    } else {
      lines.push("  Not already covered by the removals above:");
      lines.push(...list("-", notAlreadyListed));
    }
  }
  lines.push(
    "",
    `  Fix: pnpm docs:index && git add ${INDEX} && git commit`,
    "  The regenerated file has been left in the working tree, so it only needs committing.",
  );
  if (wantDiff) {
    const diff = run("git", ["--no-pager", "diff", "--no-color", "--", INDEX], { cwd, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
    if (!diff.error && diff.stdout) lines.push("", ...diff.stdout.replace(/\n$/, "").split("\n"));
  }
  return { status: 1, lines };
}

function main() {
  const wantDiff = process.argv.includes("--diff");
  const result = checkMarkdownIndex({ wantDiff });
  // Success is informational output; failures go to stderr so they survive
  // piping and read as errors in the Actions log.
  const write = result.status === 0 ? console.log : console.error;
  for (const line of result.lines) write(line);
  process.exit(result.status);
}

// Only run when executed directly, so the test suite can import the helpers.
const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : "";
if (invokedPath === import.meta.url) main();
