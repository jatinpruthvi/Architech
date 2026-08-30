import assert from "node:assert/strict";
import test from "node:test";
import { auditLocationCoverage } from "./audit-coverage.mjs";

function source(key, retrievedAt = new Date("2026-08-30T00:00:00.000Z")) {
  return {
    key,
    status: "ACTIVE",
    publisher: "Government of India",
    sourceUrl: "https://example.gov.in/source",
    licenseName: "Government Open Data License - India",
    licenseUrl: "https://ap.data.gov.in/godl",
    attribution: "Government data attribution",
    checksumSha256: "a".repeat(64),
    retrievedAt,
  };
}

function database({ postOffices = 165_000, retrievedAt } = {}) {
  const sources = [
    source("lgd-state-ut-registry-2026-08-30", retrievedAt),
    source("india-post-pincode-directory", retrievedAt),
    source("lgd-local-bodies-with-pin-codes", retrievedAt),
  ];
  return {
    administrativeArea: {
      count: async ({ where }) => where.type === "STATE_OR_UT" ? 36 : 3_500,
      groupBy: async () => Array.from({ length: 30 }, (_, index) => ({ parentId: `state-${index}` })),
    },
    postalCode: { count: async () => 19_000 },
    postOffice: {
      count: async () => postOffices,
      groupBy: async () => Array.from({ length: 35 }, (_, index) => ({ administrativeAreaId: `state-${index}` })),
    },
    administrativeAreaPostalCode: { count: async () => 7_411 },
    locationSource: { findUnique: async ({ where }) => sources.find((entry) => entry.key === where.key) ?? null },
    locationImportRun: { count: async () => 0 },
  };
}

const now = new Date("2026-08-30T12:00:00.000Z");

test("coverage audit passes only the official national and provenance gates", async () => {
  const result = await auditLocationCoverage(database(), now);
  assert.equal(result.ready, true);
  assert.deepEqual(result.gates, {
    stateRegistryComplete: true,
    postalDirectoryComplete: true,
    localBodyDirectoryComplete: true,
    sourcesFresh: true,
    provenanceComplete: true,
    noRunningImport: true,
  });
});

test("coverage audit fails closed for partial or stale data", async () => {
  const result = await auditLocationCoverage(database({ postOffices: 10_000, retrievedAt: new Date("2025-01-01T00:00:00.000Z") }), now);
  assert.equal(result.ready, false);
  assert.equal(result.gates.postalDirectoryComplete, false);
  assert.equal(result.gates.sourcesFresh, false);
});
