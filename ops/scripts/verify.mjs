#!/usr/bin/env node
/**
 * One command for the whole local gate, mirroring the CI steps that do not need
 * a production build or a browser.
 *
 *   pnpm verify                  # everything below
 *   pnpm verify -- --quick       # check, lint, test, ops:test only
 *   pnpm verify -- --only lint,docs-index
 *   pnpm verify -- --list
 *
 * WHY THIS EXISTS
 *
 * `pnpm quality` is `check && lint && test && db:validate`. That is a subset of
 * what CI enforces: it skips the ops Node test suites (57 tests) and every
 * governance audit. Running it and seeing green therefore proves less than it
 * looks like, and the gap only shows up as a red PR afterwards.
 *
 * It also stops at the first failure, so a broken tree takes one slow round
 * trip per problem to diagnose. This keeps going and prints a summary, so one
 * run tells you everything that is wrong.
 *
 * Deliberately excluded, because they need a build, a browser, or the network:
 * build, PWA, SEO smoke, crawl simulation, e2e, performance budget, Storybook,
 * and the Playwright suites. CI covers those.
 *
 * Stdlib-only, per ops/scripts/AGENTS.md.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const DOCS_INDEX = "docs/MARKDOWN-DOCUMENTATION-INDEX.md";

/** name -> command. Order is the reporting order; cheap checks first. */
export const CHECKS = [
  { name: "check", command: "pnpm", args: ["check"], quick: true, why: "tsc --noEmit" },
  { name: "lint", command: "pnpm", args: ["lint"], quick: true, why: "eslint src" },
  { name: "ops:test", command: "pnpm", args: ["ops:test"], quick: true, why: "node --test over ops/scripts (not covered by vitest)" },
  { name: "test", command: "pnpm", args: ["test"], quick: true, why: "vitest unit suite" },
  { name: "docs-index", special: "docs-index", why: "regenerate the markdown index and confirm it is committed" },
  { name: "db:validate", special: "db-validate", why: "prisma schema (falls back to the offline shim when the engine download is blocked)" },
  { name: "contrast", command: "pnpm", args: ["audit:contrast"], why: "WCAG contrast over real token values" },
  { name: "security", command: "pnpm", args: ["security:audit"], why: "headers, RLS, legal gates" },
  { name: "ops-audit", command: "pnpm", args: ["ops:audit"], why: "operational readiness" },
  { name: "release", command: "pnpm", args: ["release:audit"], why: "phase 1 release audit" },
  { name: "enablement", command: "pnpm", args: ["production:plan:audit"], why: "production enablement plan" },
  { name: "provisioning", command: "pnpm", args: ["provisioning:audit"], why: "env, secrets, provisioning smoke" },
  { name: "gsc", command: "pnpm", args: ["seo:gsc:audit"], why: "Search Console config" },
];

/** Resolve --quick / --only into the checks to run. */
export function selectChecks(argv, all = CHECKS) {
  const only = (() => {
    const index = argv.indexOf("--only");
    if (index === -1) return null;
    const raw = argv[index + 1] ?? "";
    return raw.split(",").map((name) => name.trim()).filter(Boolean);
  })();
  if (only) {
    const unknown = only.filter((name) => !all.some((check) => check.name === name));
    if (unknown.length) {
      return { checks: [], error: `unknown check(s): ${unknown.join(", ")}. Known: ${all.map((c) => c.name).join(", ")}` };
    }
    return { checks: all.filter((check) => only.includes(check.name)) };
  }
  if (argv.includes("--quick")) return { checks: all.filter((check) => check.quick) };
  return { checks: all };
}

/**
 * Regenerate the docs index and report whether it was already current.
 *
 * Leaves the regenerated file in place: if it was stale, the working tree is
 * now correct and only needs committing.
 */
export function docsIndexCheck({ cwd = process.cwd(), run } = {}) {
  run("node", ["ops/scripts/generate-md-index.mjs"], { cwd, stdio: "ignore" });
  const diff = run("git", ["diff", "--exit-code", "--", DOCS_INDEX], { cwd, stdio: "ignore" });
  if (diff === 0) return { status: 0, note: "already current" };
  return { status: 1, note: `was stale — ${DOCS_INDEX} regenerated, commit it` };
}

/**
 * Prisma validate needs the schema engine from binaries.prisma.sh. On a
 * restricted network that download fails with a TLS error that has nothing to
 * do with the schema, so fall back to the offline shim the repo already ships
 * and say which path was used. Reporting the raw network error as a schema
 * failure would be a false red.
 */
export function dbValidateCheck({ cwd = process.cwd(), run } = {}) {
  if (run("pnpm", ["db:validate"], { cwd, stdio: "ignore" }) === 0) {
    return { status: 0, note: "" };
  }
  if (run("pnpm", ["db:validate:offline"], { cwd, stdio: "inherit" }) === 0) {
    return { status: 0, note: "via the offline schema-engine shim (binaries.prisma.sh unreachable)" };
  }
  return { status: 1, note: "failed both online and offline" };
}

/** Run every selected check, continuing past failures. */
export function runChecks({ checks, run, cwd = process.cwd(), log = () => {} } = {}) {
  return checks.map((check) => {
    log(`\n── ${check.name} — ${check.why}`);
    let status;
    let note = "";
    if (check.special === "docs-index") {
      const result = docsIndexCheck({ cwd, run: quietRun(run) });
      status = result.status;
      note = result.note;
    } else if (check.special === "db-validate") {
      const result = dbValidateCheck({ cwd, run });
      status = result.status;
      note = result.note;
    } else {
      status = run(check.command, check.args, { cwd, stdio: "inherit" });
    }
    log(status === 0 ? `   ok${note ? ` (${note})` : ""}` : `   FAILED${note ? ` (${note})` : ""}`);
    return { name: check.name, status, note };
  });
}

/** The docs-index probe must not echo git's diff to the console. */
function quietRun(run) {
  return (command, args, options) => run(command, args, { ...options, stdio: "ignore" });
}

export function formatSummary(results) {
  const width = Math.max(...results.map((result) => result.name.length), 4);
  const lines = ["", "── summary " + "─".repeat(Math.max(0, 60)), ""];
  for (const result of results) {
    const mark = result.status === 0 ? "pass" : "FAIL";
    lines.push(`  ${mark}  ${result.name.padEnd(width)}  ${result.note}`);
  }
  const failed = results.filter((result) => result.status !== 0);
  lines.push("");
  lines.push(
    failed.length
      ? `  ${failed.length} of ${results.length} failed: ${failed.map((result) => result.name).join(", ")}`
      : `  all ${results.length} passed`,
  );
  return lines.join("\n");
}

function realRun(command, args, options) {
  const result = spawnSync(command, args, options);
  if (result.error) throw result.error;
  return result.status ?? 1;
}

function main() {
  const argv = process.argv.slice(2);
  if (argv.includes("--list")) {
    for (const check of CHECKS) {
      process.stdout.write(`${check.name.padEnd(14)} ${check.quick ? "[quick] " : "        "} ${check.why}\n`);
    }
    return;
  }
  if (!fs.existsSync(path.join(process.cwd(), "package.json"))) {
    process.stderr.write("Run this from the repository root.\n");
    process.exitCode = 1;
    return;
  }

  const selected = selectChecks(argv);
  if (selected.error) {
    process.stderr.write(`${selected.error}\n`);
    process.exitCode = 1;
    return;
  }

  const results = runChecks({ checks: selected.checks, run: realRun, log: (line) => process.stdout.write(`${line}\n`) });
  process.stdout.write(`${formatSummary(results)}\n`);
  process.exitCode = results.some((result) => result.status !== 0) ? 1 : 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : "verify failed"}\n`);
    process.exitCode = 1;
  }
}
