#!/usr/bin/env node
/**
 * Provision a disposable baseline checkout of another ref so a check can be
 * compared against it — "is this failure mine, or was it already red?"
 *
 *   pnpm baseline:worktree                        # create at origin/main + install
 *   pnpm baseline:worktree -- --base <ref>        # a different baseline
 *   pnpm baseline:worktree -- --fetch             # git fetch the ref first
 *   pnpm baseline:worktree -- --remove            # delete it
 *   pnpm baseline:worktree -- --script test:perf  # run a script in both, compare
 *
 * WHY THIS EXISTS
 *
 * The obvious shortcut is to symlink node_modules from the working checkout
 * into the worktree to skip the install. Do not do that. Next.js 16 builds with
 * Turbopack, which refuses it outright:
 *
 *   FATAL: An unexpected Turbopack error occurred.
 *   Symlink [project]/node_modules is invalid, it points out of the filesystem
 *   root
 *
 * Turbopack resolves the project root to the worktree, so a node_modules link
 * pointing at a sibling directory is outside it and the build panics before
 * emitting anything. budget.mjs then dies with "Missing .next diagnostics",
 * which reads like a broken script rather than a bad symlink.
 *
 * A real install is not expensive: with a warm pnpm store this repo installs in
 * a few seconds. That is cheaper than debugging the panic above.
 *
 * Stdlib-only, per ops/scripts/AGENTS.md.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const DEFAULT_BASE = "origin/main";
const SUFFIX = "-baseline";

/** The baseline lives beside the repo, never inside it. */
export function baselineDir(repoRoot) {
  const absolute = path.resolve(repoRoot);
  return path.join(path.dirname(absolute), `${path.basename(absolute)}${SUFFIX}`);
}

/** Ordered commands to create and provision the baseline. Pure, so testable. */
export function provisionSteps({ repoRoot, base = DEFAULT_BASE, fetch = false } = {}) {
  const dir = baselineDir(repoRoot);
  const steps = [];
  if (fetch) steps.push(["git", ["fetch", "origin", base.replace(/^origin\//, "")], { cwd: repoRoot }]);
  steps.push(["git", ["worktree", "add", "--detach", dir, base], { cwd: repoRoot }]);
  // Real install. Never `ln -s ../<repo>/node_modules` — see the header.
  steps.push(["pnpm", ["install", "--frozen-lockfile"], { cwd: dir }]);
  return steps;
}

/** Ordered commands to tear the baseline down. */
export function removeSteps({ repoRoot } = {}) {
  const dir = baselineDir(repoRoot);
  return [
    ["git", ["worktree", "remove", "--force", dir], { cwd: repoRoot }],
    ["git", ["worktree", "prune"], { cwd: repoRoot }],
  ];
}

/** Compare two exit statuses into an honest verdict. */
export function verdict({ script, baseStatus, headStatus }) {
  const failed = (status) => status !== 0;
  if (failed(baseStatus) && failed(headStatus)) {
    return { regression: false, text: `${script} fails on BOTH the baseline and this branch — pre-existing, not caused by these changes.` };
  }
  if (!failed(baseStatus) && failed(headStatus)) {
    return { regression: true, text: `${script} passes on the baseline but fails here — this branch introduced it.` };
  }
  if (failed(baseStatus) && !failed(headStatus)) {
    return { regression: false, text: `${script} fails on the baseline but passes here — this branch fixes it.` };
  }
  return { regression: false, text: `${script} passes on both.` };
}

function run(command, args, options) {
  const result = spawnSync(command, args, { stdio: "inherit", ...options });
  if (result.error) throw result.error;
  return result.status ?? 1;
}

function parseArgs(argv) {
  const flags = { remove: false, fetch: false, base: DEFAULT_BASE, script: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--remove") flags.remove = true;
    else if (arg === "--fetch") flags.fetch = true;
    else if (arg === "--base") flags.base = argv[++i];
    else if (arg === "--script") flags.script = argv[++i];
  }
  return flags;
}

async function main() {
  const repoRoot = process.cwd();
  const flags = parseArgs(process.argv.slice(2));
  const dir = baselineDir(repoRoot);

  if (!fs.existsSync(path.join(repoRoot, ".git"))) {
    process.stderr.write("Run this from the repository root.\n");
    process.exitCode = 1;
    return;
  }

  if (flags.remove) {
    if (!fs.existsSync(dir)) {
      // Report the truth instead of letting git emit "fatal: ... is not a
      // working tree" and still printing a success line.
      process.stdout.write(`No baseline at ${dir}; nothing to remove.\n`);
      return;
    }
    for (const [command, args, options] of removeSteps({ repoRoot })) run(command, args, options);
    process.stdout.write(`Removed ${dir}\n`);
    return;
  }

  if (flags.script) {
    if (!fs.existsSync(dir)) {
      process.stderr.write(`No baseline at ${dir}. Run \`pnpm baseline:worktree\` first.\n`);
      process.exitCode = 1;
      return;
    }
    process.stdout.write(`--- baseline (${dir}) ---\n`);
    const baseStatus = run("pnpm", [flags.script], { cwd: dir });
    process.stdout.write(`--- this branch (${repoRoot}) ---\n`);
    const headStatus = run("pnpm", [flags.script], { cwd: repoRoot });
    const result = verdict({ script: flags.script, baseStatus, headStatus });
    process.stdout.write(`\n${result.text}\n`);
    process.exitCode = result.regression ? 1 : 0;
    return;
  }

  if (fs.existsSync(dir)) {
    process.stdout.write(`${dir} already exists. Use --remove to replace it.\n`);
    return;
  }
  for (const [command, args, options] of provisionSteps({ repoRoot, base: flags.base, fetch: flags.fetch })) {
    run(command, args, options);
  }
  process.stdout.write(
    [
      "",
      `Baseline ready at ${dir} (${flags.base}).`,
      "  pnpm baseline:worktree -- --script <name>   # run a script in both and compare",
      "  pnpm baseline:worktree -- --remove          # clean up when done",
      "",
    ].join("\n"),
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : "baseline worktree failed"}\n`);
    process.exitCode = 1;
  });
}
