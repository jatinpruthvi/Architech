import assert from "node:assert/strict";
import test from "node:test";
import { normalizeIndiaPostRows, parseCsv } from "./import-india-post.mjs";

test("CSV parser preserves quoted commas and newlines", () => {
  const rows = parseCsv('OfficeName,Pincode,StateName,Note\n"Fort, Head Office",400001,Maharashtra,"line one\nline two"\n');
  assert.equal(rows.length, 2);
  assert.equal(rows[1][0], "Fort, Head Office");
  assert.equal(rows[1][3], "line one\nline two");
});

test("normalizer accepts official column variants and rejects unsafe rows", () => {
  const csv = [
    "CircleName,RegionName,DivisionName,OfficeName,Pincode,OfficeType,Delivery,District,StateName,Latitude,Longitude",
    "Maharashtra,Mumbai,Mumbai City,Mumbai G.P.O.,400001,HO,Delivery,Mumbai,Maharashtra,18.9388,72.8354",
    "Karnataka,Bengaluru,Bengaluru East,Whitefield S.O.,560066,SO,Delivery,Bengaluru,Karnataka,12.9698,77.7500",
    "Karnataka,Bengaluru,Bengaluru East,Missing PIN,,SO,Delivery,Bengaluru,Karnataka,12.9,77.7",
  ].join("\n");
  const result = normalizeIndiaPostRows(csv);
  assert.equal(result.rowsRead, 3);
  assert.equal(result.accepted.length, 2);
  assert.equal(result.rejected.length, 1);
  assert.equal(result.accepted[0].postalCode, "400001");
  assert.equal(result.accepted[0].coordinatePrecision, "POST_OFFICE");
  assert.equal(result.accepted[0].stateLgdCode, "27");
  assert.match(result.accepted[0].sourceRecordId, /^[a-f0-9]{64}$/);
  assert.match(result.rejected[0].errors.join(" "), /PIN/);
});

test("normalizer retains postal coverage while quarantining unsafe coordinates", () => {
  const csv = [
    "OfficeName,Pincode,StateName,District,Latitude,Longitude",
    "Reversed Coordinate B.O.,813207,Bihar,Banka,86.152,24.548",
    "Missing Pair S.O.,110001,Delhi,New Delhi,28.63,NA",
  ].join("\n");
  const result = normalizeIndiaPostRows(csv);
  assert.equal(result.accepted.length, 2);
  assert.equal(result.rejected.length, 0);
  assert.equal(result.warnings.length, 2);
  assert.equal(result.accepted[0].latitude, null);
  assert.equal(result.accepted[0].longitude, null);
  assert.equal(result.accepted[0].coordinatePrecision, "UNKNOWN");
  assert.ok(result.accepted[0].raw._architechQualityIssues.length >= 1);
});

test("normalizer resolves an explicit historic India Post spelling to the current LGD identity", () => {
  const csv = [
    "OfficeName,Pincode,StateName,District",
    "Raipur H.O.,492001,Chattisgarh,Raipur",
  ].join("\n");
  const result = normalizeIndiaPostRows(csv);
  assert.equal(result.rejected.length, 0);
  assert.equal(result.accepted[0].stateLgdCode, "22");
  assert.equal(result.accepted[0].stateName, "Chhattisgarh");
});

test("normalizer rejects state labels outside the official LGD registry", () => {
  const csv = [
    "OfficeName,Pincode,StateName,District",
    "Unknown B.O.,123456,Atlantis,Unknown",
  ].join("\n");
  const result = normalizeIndiaPostRows(csv);
  assert.equal(result.accepted.length, 0);
  assert.match(result.rejected[0].errors.join(" "), /official LGD registry/);
});

test("normalizer detects duplicate stable post-office identities", () => {
  const csv = [
    "OfficeName,Pincode,StateName,District",
    "Vesu S.O.,395007,Gujarat,Surat",
    "Vesu S.O.,395007,Gujarat,Surat",
  ].join("\n");
  const result = normalizeIndiaPostRows(csv);
  assert.equal(result.accepted.length, 1);
  assert.equal(result.rejected.length, 1);
  assert.match(result.rejected[0].errors.join(" "), /Duplicate/);
});
