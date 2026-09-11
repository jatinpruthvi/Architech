import assert from "node:assert/strict";
import test from "node:test";
import { downloadOgdResource, OGD_RESOURCES, parseOgdDate, recordsToCsv, validateOgdSnapshotManifest } from "./fetch-ogd-snapshot.mjs";

function response(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => null },
    json: async () => body,
  };
}

function postalRecord(index) {
  return {
    circlename: "Test Circle",
    regionname: "Test Region",
    divisionname: "Test Division",
    officename: `Office ${index}`,
    pincode: String(110001 + index),
    officetype: "BO",
    delivery: "Delivery",
    district: "TEST DISTRICT",
    statename: "DELHI",
    latitude: "NA",
    longitude: "NA",
  };
}

test("OGD downloader follows the server's effective page size and verifies completeness", async () => {
  const resource = OGD_RESOURCES["india-post"];
  const total = 23;
  const offsets = [];
  const fetchImpl = async (url) => {
    const offset = Number(url.searchParams.get("offset"));
    const requested = Number(url.searchParams.get("limit"));
    offsets.push(offset);
    // Keep the fixture computationally small while retaining production metadata.
    const records = offset === 0 && requested === 1
      ? [postalRecord(0)]
      : Array.from({ length: Math.min(10, total - offset) }, (_, index) => postalRecord(offset + index));
    return response({
      status: "ok",
      active: 1,
      index_name: resource.id,
      title: resource.title,
      org: resource.expectedOrganizations,
      field: resource.fields.map((id) => ({ id })),
      total,
      count: records.length,
      limit: Math.min(requested, 10),
      offset,
      updated: 123,
      updated_date: "2026-08-30T00:00:00Z",
      version: "2.2.0",
      records,
    });
  };

  // Override the resource threshold for this unit test without weakening the
  // production definition retained by the exported registry.
  const originalMinimum = resource.minimumRows;
  const originalMaximum = resource.maximumRows;
  resource.minimumRows = 23;
  resource.maximumRows = 23;
  try {
    const result = await downloadOgdResource({ resourceName: "india-post", apiKey: "test-only", fetchImpl, requestedLimit: 100, concurrency: 2, delayMs: 0 });
    assert.equal(result.records.length, 23);
    assert.equal(result.metadata.effectivePageSize, 10);
    assert.deepEqual(offsets, [0, 10, 20, 0]);
  } finally {
    resource.minimumRows = originalMinimum;
    resource.maximumRows = originalMaximum;
  }
});

test("OGD downloader rejects schema drift before paging", async () => {
  const resource = OGD_RESOURCES["lgd-local-bodies"];
  const fetchImpl = async () => response({
    status: "ok",
    active: 1,
    index_name: resource.id,
    title: resource.title,
    org: resource.expectedOrganizations,
    field: [{ id: "unexpected" }],
    total: 7_411,
    offset: 0,
    records: [{ unexpected: true }],
  });
  await assert.rejects(
    downloadOgdResource({ resourceName: "lgd-local-bodies", apiKey: "test-only", fetchImpl, delayMs: 0 }),
    /schema drift/i,
  );
});

test("CSV export preserves the official field order and quoting", () => {
  const csv = recordsToCsv([{ name: 'Fort, "Head"', code: 400001 }], ["name", "code"]);
  assert.equal(csv, 'name,code\n"Fort, ""Head""",400001\n');
});

test("manifest verification binds checksum, publisher, schema, resource URLs, and GODL attribution", () => {
  const resource = OGD_RESOURCES["lgd-local-bodies"];
  const checksumSha256 = "a".repeat(64);
  const manifest = {
    schemaVersion: "architech-ogd-snapshot-v1",
    resourceId: resource.id,
    title: resource.title,
    publisher: resource.publisher,
    catalogUrl: resource.catalogUrl,
    resourceUrl: resource.resourceUrl,
    apiUrl: `https://api.data.gov.in/resource/${resource.id}`,
    licenseName: "Government Open Data License - India",
    licenseUrl: "https://ap.data.gov.in/godl",
    total: 7_411,
    recordCount: 7_411,
    fields: resource.fields,
    retrievedAt: new Date().toISOString(),
    apiUpdatedDate: "30/08/2026",
    checksumSha256,
    attribution: `${resource.publisher}, ${resource.resourceUrl}, https://ap.data.gov.in/godl`,
  };
  assert.equal(validateOgdSnapshotManifest(manifest, "lgd-local-bodies", { checksumSha256, recordCount: 7_411 }), resource);
  assert.throws(() => validateOgdSnapshotManifest({ ...manifest, publisher: "Unknown publisher" }, "lgd-local-bodies", { checksumSha256, recordCount: 7_411 }), /publisher/i);
  assert.throws(() => validateOgdSnapshotManifest({ ...manifest, checksumSha256: "b".repeat(64) }, "lgd-local-bodies", { checksumSha256, recordCount: 7_411 }), /checksum/i);
});

test("OGD dates interpret the platform's DD/MM/YYYY display format without US-date ambiguity", () => {
  assert.equal(parseOgdDate("03/10/2025").toISOString(), "2025-10-03T00:00:00.000Z");
  assert.throws(() => parseOgdDate("31/02/2026"), /invalid/i);
});
