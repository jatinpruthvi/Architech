/**
 * P1.4 (cost-reduction-audit): put the immutable raw OGD snapshot + manifest
 * into Cloudflare R2 after fetching.
 *
 * WHY: the raw snapshot is the provenance record — its checksum binds the
 * bytes, the manifest binds the bytes to a publisher, licence and field
 * schema. Today it only exists in ephemeral tmp/ on whatever machine ran the
 * fetch; R2 keeps it durably at object-storage cost with $0 egress, so a
 * re-import (or an audit) can re-derive every Postgres row without trusting
 * anyone's local disk.
 *
 * The signer below is a self-contained port of the dependency-free SigV4
 * implementation in src/lib/media/sigv4.ts (that module is pinned to
 * the official AWS worked example; this one is pinned to the same vector in
 * r2-upload.test.mjs). It is duplicated rather than imported because the
 * location scripts run in plain Node and must not pull in the Next/TS media
 * layer. If you change the algorithm here, change the vector test with it.
 *
 * Only R2 (S3-compatible) is targeted: endpoint
 *   https://<R2_ACCOUNT_ID>.r2.cloudflarestorage.com/<R2_BUCKET>/<key>
 * with a header-authored PUT signing host, x-amz-date and content-type.
 */
import { createHash, createHmac } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const EMPTY_SHA256 = createHash("sha256").update("").digest("hex");

function sha256Hex(value) {
  return createHash("sha256").update(value).digest("hex");
}

function hmac(key, data) {
  return createHmac("sha256", key).update(data).digest();
}

/** AWS's own URI encoder: uppercase %XX, unreserved set exactly
    A-Z a-z 0-9 -._~ (and '/' when not encoding it). */
function uriEncode(value, encodeSlash) {
  let out = "";
  for (const byte of new TextEncoder().encode(value)) {
    const ch = String.fromCharCode(byte);
    if ((byte >= 0x41 && byte <= 0x5a) || (byte >= 0x61 && byte <= 0x7a) || (byte >= 0x30 && byte <= 0x39) || ch === "-" || ch === "." || ch === "_" || ch === "~" || (ch === "/" && !encodeSlash)) {
      out += ch;
    } else {
      out += `%${byte.toString(16).toUpperCase().padStart(2, "0")}`;
    }
  }
  return out;
}

/** "2026-09-05T03:40:00.000Z" → { amzDate: "20260905T034000Z", dateStamp: "20260905" }. */
export function amzDates(now) {
  const iso = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  return { amzDate: iso, dateStamp: iso.slice(0, 8) };
}

/**
 * Header-authored SigV4 signature over ALL provided headers. Exported so the
 * test can pin it to the official AWS worked example. `payloadHash` must be
 * the SHA-256 of the actual body (S3 requires the canonical request's
 * payload hash to equal the x-amz-content-sha256 header when that header is
 * sent); the default is the empty-body hash, which is correct for
 * payload-less requests like the AWS doc's GET vector.
 */
export function signRequest({ method, url, region, service, accessKeyId, secretAccessKey, headers = {}, now = new Date(), payloadHash = EMPTY_SHA256 }) {
  const parsed = new URL(url);
  const headerMap = { host: parsed.host };
  for (const [name, value] of Object.entries(headers)) headerMap[name.toLowerCase()] = String(value).trim().replace(/\s+/g, " ");
  const names = Object.keys(headerMap).sort();
  const canonicalHeaders = names.map((name) => `${name}:${headerMap[name]}\n`).join("");
  const canonicalQuery = [...parsed.searchParams.entries()]
    .map(([key, value]) => `${uriEncode(key, true)}=${uriEncode(value, true)}`)
    .sort()
    .join("&");
  const canonicalUri = parsed.pathname === "" ? "/" : parsed.pathname.split("/").map((segment) => uriEncode(segment, false)).join("/");
  const { dateStamp, amzDate } = amzDates(now);
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const canonicalRequest = [method, canonicalUri, canonicalQuery, canonicalHeaders, names.join(";"), payloadHash].join("\n");
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, credentialScope, sha256Hex(canonicalRequest)].join("\n");
  const dateKey = hmac(`AWS4${secretAccessKey}`, dateStamp);
  const signingKey = hmac(hmac(hmac(dateKey, region), service), "aws4_request");
  const signature = hmac(signingKey, stringToSign).toString("hex");
  return {
    authorization: `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${names.join(";")}, Signature=${signature}`,
    amzDate,
  };
}

/**
 * PUT one object to R2 with a header-signed request. The ACTUAL body hash is
 * signed and sent as x-amz-content-sha256, so R2 rejects a corrupted or
 * truncated upload instead of silently storing it. Returns
 * { objectKey, status }; throws on transport or HTTP failure.
 */
export async function putObjectToR2({ env, objectKey, body, contentType, fetchImpl = fetch, now = new Date() }) {
  const accountId = env.R2_ACCOUNT_ID;
  const bucket = env.R2_BUCKET;
  const accessKeyId = env.R2_ACCESS_KEY_ID;
  const secretAccessKey = env.R2_SECRET_ACCESS_KEY;
  const region = env.R2_REGION || "auto";
  if (!accountId || !bucket || !accessKeyId || !secretAccessKey) {
    throw new Error("R2 is not configured: R2_ACCOUNT_ID, R2_BUCKET, R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY are all required to upload snapshots.");
  }
  const url = `https://${accountId}.r2.cloudflarestorage.com/${bucket}/${objectKey.split("/").map((segment) => uriEncode(segment, false)).join("/")}`;
  const amzDate = amzDates(now).amzDate;
  const bodyBuffer = Buffer.isBuffer(body) ? body : Buffer.from(String(body), "utf8");
  const payloadHash = sha256Hex(bodyBuffer);
  const signed = signRequest({
    method: "PUT",
    url,
    region,
    service: "s3",
    accessKeyId,
    secretAccessKey,
    headers: { "x-amz-date": amzDate, "x-amz-content-sha256": payloadHash, "content-type": contentType },
    now,
    payloadHash,
  });
  const res = await fetchImpl(url, {
    method: "PUT",
    headers: {
      host: new URL(url).host,
      "x-amz-date": amzDate,
      "x-amz-content-sha256": payloadHash,
      "content-type": contentType,
      authorization: signed.authorization,
    },
    body: bodyBuffer,
  });
  if (!res.ok) {
    throw new Error(`R2 PUT ${objectKey} failed with HTTP ${res.status}.`);
  }
  return { objectKey, status: res.status };
}

/**
 * Deterministic, immutable snapshot keys under a per-retrieval stamp so two
 * fetches on the same day never overwrite each other:
 *   location-snapshots/<resource>/<YYYY-MM-DDTHHMMSSZ>/<basename>
 */
export function snapshotObjectKeys(resourceName, retrievedAt, baseName) {
  const stamp = new Date(retrievedAt).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const prefix = `location-snapshots/${resourceName}/${stamp}`;
  return { csvKey: `${prefix}/${baseName}`, manifestKey: `${prefix}/${baseName}.manifest.json` };
}

async function atomicWrite(file, content) {
  await mkdir(dirname(file), { recursive: true });
  const temporary = `${file}.partial-${process.pid}`;
  await writeFile(temporary, content, { mode: 0o600 });
  await rename(temporary, file);
}

/**
 * Upload the raw snapshot CSV and its manifest to R2, then stamp the
 * manifest's `r2` section with the object keys and atomically rewrite it.
 * The manifest is uploaded AFTER the stamp so the copy in R2 is
 * self-describing (an auditor can find the CSV from the manifest alone).
 * The CSV is uploaded BEFORE the manifest: if the run dies between the two
 * PUTs, R2 holds an orphan CSV with no (self-describing) manifest — the
 * opposite order would leave a manifest pointing at a CSV that was never
 * there.
 */
export async function uploadSnapshotToR2({ env, resourceName, csvFile, manifest, manifestFile, fetchImpl = fetch, now = new Date() }) {
  const baseName = csvFile.replace(/^.*\//, "");
  const keys = snapshotObjectKeys(resourceName, manifest.retrievedAt, baseName);
  const csvBytes = await readFile(csvFile);
  await putObjectToR2({ env, objectKey: keys.csvKey, body: csvBytes, contentType: "text/csv", fetchImpl, now });
  manifest.r2 = {
    account: env.R2_ACCOUNT_ID,
    bucket: env.R2_BUCKET,
    csvKey: keys.csvKey,
    manifestKey: keys.manifestKey,
    uploadedAt: now.toISOString(),
  };
  const manifestText = `${JSON.stringify(manifest, null, 2)}\n`;
  await atomicWrite(manifestFile, manifestText);
  await putObjectToR2({ env, objectKey: keys.manifestKey, body: manifestText, contentType: "application/json", fetchImpl, now });
  return manifest.r2;
}
