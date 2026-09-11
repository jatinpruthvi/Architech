import assert from "node:assert/strict";
import test from "node:test";
import { normalizeLgdLocalBodyRows } from "./import-lgd-local-bodies.mjs";

test("LGD normalizer preserves local-body identity and many-to-many PIN links", () => {
  const csv = [
    "stateCode,stateNameEnglish,localBodyCode,localBodyNameEnglish,localBodyTypeName,pincode",
    "24,Gujarat,251141,Ahmedabad,Municipal Corporations,380001",
    "24,Gujarat,251141,Ahmedabad,Municipal Corporations,380006",
    "29,Karnataka,276470,Hagaribommanahalli,Municipality,583212",
  ].join("\n");
  const result = normalizeLgdLocalBodyRows(csv);
  assert.equal(result.rowsRead, 3);
  assert.equal(result.accepted.length, 3);
  assert.equal(result.rejected.length, 0);
  assert.deepEqual(result.accepted.slice(0, 2).map((row) => row.localBodyCode), ["251141", "251141"]);
  assert.deepEqual(result.accepted.slice(0, 2).map((row) => row.postalCode), ["380001", "380006"]);
});

test("LGD normalizer rejects unknown states, identity conflicts, bad PINs, and duplicate links", () => {
  const csv = [
    "stateCode,stateNameEnglish,localBodyCode,localBodyNameEnglish,localBodyTypeName,pincode",
    "24,Gujarat,251141,Ahmedabad,Municipal Corporations,380001",
    "24,Gujarat,251141,Ahmedabad,Municipal Corporations,380001",
    "24,Rajasthan,251141,Conflicting Name,Municipality,380002",
    "99,Unknown,991,Unknown Body,Municipality,123456",
    "29,Karnataka,276470,Hagaribommanahalli,Municipality,123",
  ].join("\n");
  const result = normalizeLgdLocalBodyRows(csv);
  assert.equal(result.accepted.length, 1);
  assert.equal(result.rejected.length, 4);
  assert.match(result.rejected.flatMap((row) => row.errors).join(" "), /Duplicate/);
  assert.match(result.rejected.flatMap((row) => row.errors).join(" "), /does not match/);
  assert.match(result.rejected.flatMap((row) => row.errors).join(" "), /official 36-entry/);
  assert.match(result.rejected.flatMap((row) => row.errors).join(" "), /PIN/);
});
