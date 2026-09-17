#!/usr/bin/env node
/**
 * Fail when a suite that is supposed to run was skipped instead.
 *
 *   node ops/scripts/assert-tests-ran.mjs <vitest-json> <file> [<file> ...]
 *   pnpm test:assert-parity              # the search parity matrix, from tmp/unit.json
 *
 * WHY THIS EXISTS
 *
 * A vitest exit code cannot tell "48 passed" from "48 skipped" — both are 0.
 * src/lib/search/sql-page-integration.test.ts is opt-in behind
 * ARCHITECH_PARITY_DATABASE_URL, so when CI had no database the whole file
 * became describe.skip, the "Unit tests" step stayed green, and the suite its
 * own header calls "the guardrail the whole rebuild depends on" never ran once.
 * Four months of green builds proved nothing about SQL/JS search parity.
 *
 * Reading the JSON report closes that: the variable can be present in the
 * workflow and still be empty, misspelled at the point of use, or point at a
 * database that never came up in a way that skips rather than fails. This
 * asserts the outcome, not the configuration.
 *
 * Stdlib-only, per ops/scripts/AGENTS.md.
 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

/** Statuses vitest reports for a test that did not actually execute. */
const NOT_RUN = new Set(["pending", "skipped", "todo", "disabled"]);

/**
 * Check one report against the files that must have executed.
 *
 * `needle` matches on the reported absolute path, so callers can pass a
 * repo-relative fragment without knowing where the runner put the checkout.
 */
export function assertTestsRan(report, needles) {
  const results = Array.isArray(report?.testResults) ? report.testResults : null;
  if (!results) {
    return { ok: false, lines: ["the vitest JSON report has no testResults — wrong reporter, or the run did not finish"] };
  }

  const lines = [];
  const failures = [];

  for (const needle of needles) {
    const wanted = needle.replaceAll("\\", "/");
    const matches = results.filter((entry) => String(entry.name ?? "").replaceAll("\\", "/").endsWith(wanted) || String(entry.name ?? "").replaceAll("\\", "/").includes(wanted));

    if (matches.length === 0) {
      failures.push(`${wanted}: not in the report at all — was the file renamed, moved, or excluded from the run?`);
      continue;
    }

    for (const entry of matches) {
      const name = String(entry.name).replaceAll("\\", "/").split("/").slice(-2).join("/");
      const assertions = Array.isArray(entry.assertionResults) ? entry.assertionResults : [];
      const counts = { passed: 0, failed: 0, notRun: 0 };
      for (const assertion of assertions) {
        if (NOT_RUN.has(assertion.status)) counts.notRun += 1;
        else if (assertion.status === "passed") counts.passed += 1;
        else counts.failed += 1;
      }

      if (assertions.length === 0) {
        failures.push(`${name}: reported no tests — an empty describe, or the file skipped itself before registering any`);
      } else if (counts.notRun > 0) {
        failures.push(`${name}: ${counts.notRun} of ${assertions.length} tests did not run (${counts.passed} passed) — the suite skipped itself, so it proved nothing`);
      } else {
        lines.push(`  ran  ${name}  ${counts.passed}/${assertions.length} passed`);
      }
    }
  }

  const total = report.numTotalTests ?? 0;
  const passed = report.numPassedTests ?? 0;
  const pending = report.numPendingTests ?? 0;
  const failed = report.numFailedTests ?? 0;
  const summary = `report totals: ${passed} passed, ${pending} skipped, ${failed} failed of ${total}`;

  if (failures.length > 0) {
    return {
      ok: false,
      lines: ["Some suites that must execute were skipped:", "", ...failures.map((line) => `  - ${line}`), "", `  ${summary}`, "", "  A skipped guardrail is worse than a failing one: it reports green while asserting nothing."],
    };
  }
  return { ok: true, lines: [...lines, `  ${summary}`] };
}

function main() {
  const [reportPath, ...needles] = process.argv.slice(2);
  if (!reportPath || needles.length === 0) {
    console.error("usage: node ops/scripts/assert-tests-ran.mjs <vitest-json> <file> [<file> ...]");
    process.exit(2);
  }

  let report;
  try {
    report = JSON.parse(fs.readFileSync(path.resolve(reportPath), "utf8"));
  } catch (error) {
    console.error(`could not read the vitest JSON report at ${reportPath}: ${error.message}`);
    console.error("  The test step must run with --reporter=json --outputFile.json=<path>.");
    process.exit(2);
  }

  const result = assertTestsRan(report, needles);
  const write = result.ok ? console.log : console.error;
  for (const line of result.lines) write(line);
  process.exit(result.ok ? 0 : 1);
}

// Only run when executed directly, so the test suite can import the helper.
const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : "";
if (invokedPath === import.meta.url) main();
