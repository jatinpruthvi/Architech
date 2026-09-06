import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { amzDates, putObjectToR2, signRequest, snapshotObjectKeys, uploadSnapshotToR2 } from "./r2-upload.mjs";

const ENV = {
  R2_ACCOUNT_ID: "ab12cd34",
  R2_BUCKET: "architech-ops",
  R2_ACCESS_KEY_ID: "R2KEYID",
  R2_SECRET_ACCESS_KEY: "r2secret",
};

test("signRequest reproduces the official AWS worked-example signature exactly", () => {
  // The worked example from the AWS IAM User Guide's SigV4 documentation
  // (GET ListUsers against iam.amazonaws.com, signed 2015-08-30T12:36:00Z).
  // Same vector that pins client/src/lib/media/sigv4.ts — a drift in this
  // port breaks the byte-exact canonicalization and the signature changes.
  const signed = signRequest({
    method: "GET",
    url: "https://iam.amazonaws.com/?Action=ListUsers&Version=2010-05-08",
    region: "us-east-1",
    service: "iam",
    accessKeyId: "AKIDEXAMPLE",
    secretAccessKey: "wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY",
    headers: { "content-type": "application/x-www-form-urlencoded; charset=utf-8", "x-amz-date": "20150830T123600Z" },
    now: new Date("2015-08-30T12:36:00.000Z"),
  });
  assert.equal(signed.amzDate, "20150830T123600Z");
  assert.equal(signed.authorization,
    "AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE/20150830/us-east-1/iam/aws4_request, " +
      "SignedHeaders=content-type;host;x-amz-date, Signature=5d672d79c15b13162d9279b0855cfba6789a8edb4c82c400e06b5924a6f2b5d7");
});

test("amzDates uses the AWS layout", () => {
  assert.deepEqual(amzDates(new Date("2026-09-05T03:04:05.678Z")), { amzDate: "20260905T030405Z", dateStamp: "20260905" });
});

test("putObjectToR2 signs the real body hash and PUTs to the S3 API", async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    return { ok: true, status: 200 };
  };
  const body = Buffer.from("a,b,c\n1,2,3\n");
  const result = await putObjectToR2({
    env: ENV,
    objectKey: "location-snapshots/india-post/20260830T150000Z/india-post.csv",
    body,
    contentType: "text/csv",
    fetchImpl,
    now: new Date("2026-08-30T15:00:00.000Z"),
  });
  assert.equal(result.objectKey, "location-snapshots/india-post/20260830T150000Z/india-post.csv");
  assert.equal(calls.length, 1);
  const { url, init } = calls[0];
  assert.equal(url, "https://ab12cd34.r2.cloudflarestorage.com/architech-ops/location-snapshots/india-post/20260830T150000Z/india-post.csv");
  assert.equal(init.method, "PUT");
  assert.equal(init.headers["x-amz-date"], "20260830T150000Z");
  assert.equal(init.headers["content-type"], "text/csv");
  assert.equal(init.headers.host, "ab12cd34.r2.cloudflarestorage.com");
  assert.match(init.headers.authorization, /^AWS4-HMAC-SHA256 Credential=R2KEYID\/20260830\/auto\/s3\/aws4_request, SignedHeaders=content-type;host;x-amz-content-sha256;x-amz-date, Signature=[0-9a-f]{64}$/);
  // The signed payload hash is the hash of the REAL body, not the empty hash.
  const expectedBodyHash = createHash("sha256").update(body).digest("hex");
  assert.equal(init.headers["x-amz-content-sha256"], expectedBodyHash);
  assert.equal(Buffer.compare(Buffer.from(init.body), body), 0);
});

test("putObjectToR2 is deterministic for identical input and clock, and changes with the body", async () => {
  const capture = () => {
    const calls = [];
    const fetchImpl = async (url, init) => { calls.push({ url, init }); return { ok: true, status: 200 }; };
    return { fetchImpl, calls };
  };
  const now = new Date("2026-08-30T15:00:00.000Z");
  const a = capture();
  const b = capture();
  await putObjectToR2({ env: ENV, objectKey: "k/a.csv", body: "same", contentType: "text/csv", fetchImpl: a.fetchImpl, now });
  await putObjectToR2({ env: ENV, objectKey: "k/a.csv", body: "same", contentType: "text/csv", fetchImpl: b.fetchImpl, now });
  assert.equal(a.calls[0].init.headers.authorization, b.calls[0].init.headers.authorization);
  const c = capture();
  await putObjectToR2({ env: ENV, objectKey: "k/a.csv", body: "other", contentType: "text/csv", fetchImpl: c.fetchImpl, now });
  assert.notEqual(c.calls[0].init.headers.authorization, a.calls[0].init.headers.authorization);
});

test("putObjectToR2 fails closed without credentials and on HTTP errors", async () => {
  await assert.rejects(
    putObjectToR2({ env: { R2_ACCOUNT_ID: "x" }, objectKey: "k", body: "b", contentType: "text/csv" }),
    /R2 is not configured/,
  );
  const fetchImpl = async () => ({ ok: false, status: 403 });
  await assert.rejects(
    putObjectToR2({ env: ENV, objectKey: "k", body: "b", contentType: "text/csv", fetchImpl }),
    /HTTP 403/,
  );
});

test("snapshotObjectKeys are deterministic and unique per retrieval", () => {
  const a = snapshotObjectKeys("india-post", "2026-08-30T15:07:53.000Z", "india-post.csv");
  const b = snapshotObjectKeys("india-post", "2026-08-30T15:07:53.000Z", "india-post.csv");
  const c = snapshotObjectKeys("india-post", "2026-08-30T15:07:54.000Z", "india-post.csv");
  assert.deepEqual(a, b);
  assert.notEqual(a.csvKey, c.csvKey);
  assert.match(a.csvKey, /^location-snapshots\/india-post\/20260830T150753Z\/india-post\.csv$/);
  assert.equal(a.manifestKey, `${a.csvKey}.manifest.json`);
});

test("uploadSnapshotToR2 uploads CSV then the stamped manifest, and rewrites the local manifest", async () => {
  const dir = await mkdir(join(tmpdir(), `architech-r2-test-${process.pid}-${Date.now()}`), { recursive: true });
  try {
    const csvFile = join(dir, "lgd.csv");
    const manifestFile = `${csvFile}.manifest.json`;
    await writeFile(csvFile, "stateCode,stateNameEnglish,localBodyCode,localBodyNameEnglish,localBodyTypeName,pincode\n24,Gujarat,24001,Gandhinagar City,GMC,380001\n");
    const manifest = {
      schemaVersion: "architech-ogd-snapshot-v1",
      resourceId: "71818d1a-c114-46cb-aa9b-56ed70d4bc4a",
      retrievedAt: "2026-08-30T15:07:53.000Z",
      recordCount: 1,
      checksumSha256: "a".repeat(64),
    };
    const calls = [];
    const fetchImpl = async (url, init) => { calls.push({ url, body: init.body }); return { ok: true, status: 200 }; };
    const stamp = await uploadSnapshotToR2({
      env: ENV,
      resourceName: "lgd-local-bodies",
      csvFile,
      manifest,
      manifestFile,
      fetchImpl,
      now: new Date("2026-08-30T16:00:00.000Z"),
    });
    assert.equal(calls.length, 2);
    assert.match(calls[0].url, /\/architech-ops\/location-snapshots\/lgd-local-bodies\/20260830T150753Z\/lgd\.csv$/);
    assert.match(calls[1].url, /\/lgd\.csv\.manifest\.json$/);
    // The manifest's r2 section names both objects; the uploaded manifest
    // carries the section (self-describing in R2).
    assert.equal(stamp.csvKey, "location-snapshots/lgd-local-bodies/20260830T150753Z/lgd.csv");
    assert.equal(stamp.manifestKey, "location-snapshots/lgd-local-bodies/20260830T150753Z/lgd.csv.manifest.json");
    assert.equal(stamp.bucket, "architech-ops");
    const uploadedManifest = JSON.parse(calls[1].body.toString("utf8"));
    assert.equal(uploadedManifest.r2.csvKey, stamp.csvKey);
    assert.equal(uploadedManifest.r2.manifestKey, stamp.manifestKey);
    assert.equal(uploadedManifest.r2.uploadedAt, "2026-08-30T16:00:00.000Z");
    // Local manifest rewritten with the same stamp.
    const { readFile } = await import("node:fs/promises");
    const localManifest = JSON.parse(await readFile(manifestFile, "utf8"));
    assert.equal(localManifest.r2.csvKey, stamp.csvKey);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
