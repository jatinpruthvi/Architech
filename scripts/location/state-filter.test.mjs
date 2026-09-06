import assert from "node:assert/strict";
import test from "node:test";
import { filterRowsByStates, resolveStateFilter } from "./state-filter.mjs";

test("resolveStateFilter: absent/empty selector means no filtering", () => {
  assert.equal(resolveStateFilter(undefined), null);
  assert.equal(resolveStateFilter(""), null);
  assert.equal(resolveStateFilter("   "), null);
});

test("resolveStateFilter: names are case/diacritic-insensitive and alias-aware", () => {
  assert.deepEqual(resolveStateFilter("gujarat"), new Set(["24"]));
  assert.deepEqual(resolveStateFilter("Gujarat"), new Set(["24"]));
  assert.deepEqual(resolveStateFilter("GUJARAT"), new Set(["24"]));
  assert.deepEqual(resolveStateFilter("odisha"), new Set(["21"]));
  assert.deepEqual(resolveStateFilter("Orissa"), new Set(["21"]));
  assert.deepEqual(resolveStateFilter("Jammu & Kashmir"), new Set(["1"]));
});

test("resolveStateFilter: LGD codes and mixed name/code selectors", () => {
  assert.deepEqual(resolveStateFilter("24"), new Set(["24"]));
  assert.deepEqual(resolveStateFilter("gujarat, 27"), new Set(["24", "27"]));
  assert.deepEqual(resolveStateFilter("gujarat,24"), new Set(["24"]));
});

test("resolveStateFilter: unknown states are an error, never a silent no-op", () => {
  assert.throws(() => resolveStateFilter("kashmir"), /Unknown state/);
  assert.throws(() => resolveStateFilter("gujarat,99"), /99/);
});

test("filterRowsByStates keeps only the requested states and reports the drop", () => {
  const rows = [
    { stateLgdCode: "24", name: "Gandhinagar PO" },
    { stateLgdCode: "27", name: "Mumbai PO" },
    { stateLgdCode: "24", name: "Ahmedabad PO" },
    { stateLgdCode: null, name: "Stateless PO" },
  ];
  const { kept, dropped } = filterRowsByStates(rows, resolveStateFilter("gujarat"), (row) => row.stateLgdCode);
  assert.deepEqual(kept.map((row) => row.name), ["Gandhinagar PO", "Ahmedabad PO"]);
  assert.equal(dropped, 2);
});

test("filterRowsByStates adapts to the LGD row shape (stateCode)", () => {
  const rows = [
    { stateCode: "24", localBodyCode: "24001" },
    { stateCode: "29", localBodyCode: "29001" },
  ];
  const { kept, dropped } = filterRowsByStates(rows, resolveStateFilter("24"), (row) => row.stateCode);
  assert.deepEqual(kept, [{ stateCode: "24", localBodyCode: "24001" }]);
  assert.equal(dropped, 1);
});
