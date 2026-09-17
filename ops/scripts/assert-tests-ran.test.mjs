import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { assertTestsRan } from "./assert-tests-ran.mjs";

const REPO_ROOT = path.resolve(import.meta.dirname, "../..");
const PARITY = "src/lib/search/sql-page-integration.test.ts";

/** A vitest JSON report with one file, whose tests have the given statuses. */
function report(name, statuses, totals = {}) {
  return {
    numTotalTests: statuses.length,
    numPassedTests: statuses.filter((status) => status === "passed").length,
    numPendingTests: statuses.filter((status) => status === "pending").length,
    numFailedTests: statuses.filter((status) => status === "failed").length,
    ...totals,
    testResults: [{ name, assertionResults: statuses.map((status) => ({ status })) }],
  };
}

test("a fully executed suite passes", () => {
  const result = assertTestsRan(report("/runner/work/repo/" + PARITY, ["passed", "passed", "passed"]), [PARITY]);
  assert.equal(result.ok, true);
  assert.match(result.lines.join("\n"), /3\/3 passed/);
});

test("a suite that skipped itself fails, and says it proved nothing", () => {
  // The exact regression this guards: describe.skip yields pending assertions
  // and the vitest exit code is still 0.
  const result = assertTestsRan(report("/runner/work/repo/" + PARITY, ["pending", "pending"]), [PARITY]);
  assert.equal(result.ok, false);
  const text = result.lines.join("\n");
  assert.match(text, /did not run/);
  assert.match(text, /proved nothing/);
  assert.match(text, /green while asserting nothing/);
});

test("a partially skipped suite fails", () => {
  const result = assertTestsRan(report("/runner/work/repo/" + PARITY, ["passed", "passed", "pending"]), [PARITY]);
  assert.equal(result.ok, false);
  assert.match(result.lines.join("\n"), /1 of 3 tests did not run/);
});

test("a suite missing from the report fails instead of passing vacuously", () => {
  const result = assertTestsRan(report("/runner/work/repo/src/lib/other.test.ts", ["passed"]), [PARITY]);
  assert.equal(result.ok, false);
  assert.match(result.lines.join("\n"), /not in the report at all/);
});

test("an empty describe fails", () => {
  const result = assertTestsRan(report("/runner/work/repo/" + PARITY, []), [PARITY]);
  assert.equal(result.ok, false);
  assert.match(result.lines.join("\n"), /reported no tests/);
});

test("a malformed report is reported as such, not as a pass", () => {
  assert.equal(assertTestsRan({}, [PARITY]).ok, false);
  assert.equal(assertTestsRan(null, [PARITY]).ok, false);
  assert.match(assertTestsRan({}, [PARITY]).lines.join("\n"), /no testResults/);
});

test("windows-style paths still match", () => {
  const result = assertTestsRan(report("C:\\runner\\work\\repo\\src\\lib\\search\\sql-page-integration.test.ts", ["passed"]), [PARITY]);
  assert.equal(result.ok, true);
});

test("every named suite must pass, not just the first", () => {
  const two = {
    numTotalTests: 2,
    numPassedTests: 1,
    numPendingTests: 1,
    numFailedTests: 0,
    testResults: [
      { name: "/repo/src/a.test.ts", assertionResults: [{ status: "passed" }] },
      { name: "/repo/src/b.test.ts", assertionResults: [{ status: "pending" }] },
    ],
  };
  const result = assertTestsRan(two, ["src/a.test.ts", "src/b.test.ts"]);
  assert.equal(result.ok, false);
  assert.match(result.lines.join("\n"), /b\.test\.ts/);
});

test("CI emits the report and asserts the parity matrix ran", () => {
  // Guards the wiring: without the JSON reporter there is nothing to assert
  // against, and without the assertion the suite can skip itself in silence.
  // The commands live in package.json; the workflow only invokes them, so both
  // files have to be checked or either half can drift.
  const workflow = fs.readFileSync(path.join(REPO_ROOT, ".github/workflows/ci.yml"), "utf8");
  const scripts = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "package.json"), "utf8")).scripts;

  assert.match(workflow, /pnpm test:report/, "the unit test step must produce the JSON report");
  assert.match(scripts["test:report"], /--reporter=json/, "test:report must emit JSON");
  assert.match(scripts["test:report"], /--outputFile\.json=/, "the JSON report needs an output path");

  assert.match(workflow, /pnpm test:assert-parity/, "CI must assert the parity matrix executed");
  assert.match(scripts["test:assert-parity"], /assert-tests-ran\.mjs/);
  assert.match(scripts["test:assert-parity"], /sql-page-integration\.test\.ts/, "the parity suite must be named");

  // Order matters: asserting before the report exists would exit 2 every time.
  assert.equal(workflow.indexOf("pnpm test:report") < workflow.indexOf("pnpm test:assert-parity"), true, "the assertion must follow the test run");
});

test("the parity suite is still opt-in on the env var, so the assertion has teeth", () => {
  // If the file ever stops keying off ARCHITECH_PARITY_DATABASE_URL this check
  // becomes decoration; if the variable is renamed the assertion catches it.
  const source = fs.readFileSync(path.join(REPO_ROOT, PARITY), "utf8");
  assert.match(source, /process\.env\.ARCHITECH_PARITY_DATABASE_URL/);
  assert.match(source, /describe\.skip/);
});
