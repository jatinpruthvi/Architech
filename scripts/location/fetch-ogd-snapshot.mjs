#!/usr/bin/env node
/**
 * Download a complete, immutable snapshot from an official data.gov.in API.
 *
 * The API key is read only from DATA_GOV_IN_API_KEY and is never logged or
 * written to a manifest. Bulk output belongs in ignored tmp/ or approved
 * versioned object storage, never in Git.
 *
 * Usage:
 *   DATA_GOV_IN_API_KEY=... pnpm location:fetch:ogd -- \
 *     --resource india-post --output tmp/location/india-post.csv
 *
 *   DATA_GOV_IN_API_KEY=... pnpm location:fetch:ogd -- \
 *     --resource lgd-local-bodies --output tmp/location/lgd-local-bodies.csv
 */
import { createHash } from "node:crypto";
import { mkdir, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const OGD_RESOURCES = {
  "india-post": {
    id: "5c2f62fe-5afa-4119-a499-fec9d604d5bd",
    title: "All India Pincode Directory till last month",
    publisher: "Department of Posts, Ministry of Communications, Government of India",
    expectedOrganizations: ["Department of Posts"],
    fields: ["circlename", "regionname", "divisionname", "officename", "pincode", "officetype", "delivery", "district", "statename", "latitude", "longitude"],
    minimumRows: 150_000,
    maximumRows: 250_000,
    catalogUrl: "https://www.data.gov.in/catalog/all-india-pincode-directory-through-webservice",
    resourceUrl: "https://www.data.gov.in/resource/all-india-pincode-directory-till-last-month",
  },
  "lgd-local-bodies": {
    id: "71818d1a-c114-46cb-aa9b-56ed70d4bc4a",
    title: "Local Government Directory (LGD) - Local Bodies with PIN Codes",
    publisher: "Ministry of Panchayati Raj, Government of India",
    expectedOrganizations: ["Ministry of Panchayati Raj"],
    fields: ["stateCode", "stateNameEnglish", "localBodyCode", "localBodyNameEnglish", "localBodyTypeName", "pincode"],
    minimumRows: 4_000,
    maximumRows: 20_000,
    catalogUrl: "https://www.data.gov.in/catalog/local-government-directory-lgd",
    resourceUrl: "https://www.data.gov.in/resource/local-government-directory-lgd-local-bodies-pin-codes",
  },
};

const API_ORIGIN = "https://api.data.gov.in";
const LICENSE_NAME = "Government Open Data License - India";
const LICENSE_URL = "https://ap.data.gov.in/godl";

function parsePositiveInteger(value, label, fallback, maximum) {
  if (value === undefined) return fallback;
  if (!/^\d+$/.test(String(value))) throw new Error(`${label} must be a positive integer.`);
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 1 || number > maximum) throw new Error(`${label} must be between 1 and ${maximum}.`);
  return number;
}

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--help" || argument === "-h") options.help = true;
    else if (argument.startsWith("--")) {
      const key = argument.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) throw new Error(`${argument} requires a value.`);
      options[key] = value;
      index += 1;
    } else throw new Error(`Unknown argument: ${argument}`);
  }
  return options;
}

function sleep(milliseconds) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));
}

function retryDelay(response, attempt) {
  const retryAfter = Number(response?.headers?.get?.("retry-after"));
  if (Number.isFinite(retryAfter) && retryAfter >= 0) return Math.min(retryAfter * 1_000, 30_000);
  return Math.min(500 * (2 ** attempt), 15_000);
}

async function requestPage({ resource, apiKey, offset, requestedLimit, fetchImpl, retries, timeoutMs }) {
  const endpoint = new URL(`/resource/${resource.id}`, API_ORIGIN);
  endpoint.searchParams.set("api-key", apiKey);
  endpoint.searchParams.set("format", "json");
  endpoint.searchParams.set("offset", String(offset));
  endpoint.searchParams.set("limit", String(requestedLimit));

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(endpoint, { headers: { Accept: "application/json" }, signal: controller.signal });
      if (response.ok) {
        const body = await response.json();
        if (body?.status !== "ok" || !Array.isArray(body.records)) {
          throw new Error(`OGD returned an invalid response at offset ${offset}.`);
        }
        return body;
      }
      if ((response.status === 429 || response.status >= 500) && attempt < retries) {
        await sleep(retryDelay(response, attempt));
        continue;
      }
      throw new Error(`OGD request failed with HTTP ${response.status} at offset ${offset}.`);
    } catch (error) {
      if (attempt >= retries) {
        const message = error instanceof Error && error.name === "AbortError"
          ? `OGD request timed out at offset ${offset}.`
          : error instanceof Error ? error.message : String(error);
        // Never include endpoint.toString(): it contains the API key.
        throw new Error(message, { cause: error });
      }
      await sleep(retryDelay(null, attempt));
    } finally {
      clearTimeout(timeout);
    }
  }
  throw new Error(`OGD request failed at offset ${offset}.`);
}

function validateMetadata(body, resource) {
  if (body.index_name !== resource.id) throw new Error(`OGD resource identity mismatch: expected ${resource.id}.`);
  if (body.title !== resource.title) throw new Error(`OGD title mismatch for ${resource.id}.`);
  if (String(body.active) !== "1") throw new Error(`OGD resource ${resource.id} is not active.`);
  const organizations = Array.isArray(body.org) ? body.org : [];
  if (!resource.expectedOrganizations.every((organization) => organizations.includes(organization))) {
    throw new Error(`OGD publisher mismatch for ${resource.id}.`);
  }
  const fields = Array.isArray(body.field) ? body.field.map((entry) => entry.id) : [];
  if (fields.join("|") !== resource.fields.join("|")) throw new Error(`OGD schema drift detected for ${resource.id}.`);
  const total = Number(body.total);
  if (!Number.isSafeInteger(total) || total < resource.minimumRows || total > resource.maximumRows) {
    throw new Error(`OGD row count ${body.total} is outside the approved ${resource.minimumRows}-${resource.maximumRows} range.`);
  }
  return total;
}

function validatePage(body, resource, expectedTotal, expectedOffset) {
  if (body.index_name !== resource.id || Number(body.total) !== expectedTotal) {
    throw new Error(`OGD snapshot changed while downloading at offset ${expectedOffset}; discard and retry.`);
  }
  if (Number(body.offset) !== expectedOffset) throw new Error(`OGD returned offset ${body.offset}; expected ${expectedOffset}.`);
  if (!body.records.length && expectedOffset < expectedTotal) throw new Error(`OGD returned an empty page at offset ${expectedOffset}.`);
}

async function parallelMapOrdered(items, concurrency, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  async function consume() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, consume));
  return results;
}

export async function downloadOgdResource({
  resourceName,
  apiKey,
  fetchImpl = fetch,
  requestedLimit = 100,
  concurrency = 2,
  delayMs = 100,
  retries = 4,
  timeoutMs = 30_000,
}) {
  const resource = OGD_RESOURCES[resourceName];
  if (!resource) throw new Error(`Unknown OGD resource: ${resourceName}.`);
  if (!apiKey) throw new Error("DATA_GOV_IN_API_KEY is required; configure it as an operations secret, not in source control.");

  const first = await requestPage({ resource, apiKey, offset: 0, requestedLimit, fetchImpl, retries, timeoutMs });
  const total = validateMetadata(first, resource);
  validatePage(first, resource, total, 0);
  const effectivePageSize = first.records.length;
  if (effectivePageSize < 1) throw new Error("OGD returned no records.");

  const offsets = [];
  for (let offset = effectivePageSize; offset < total; offset += effectivePageSize) offsets.push(offset);
  const pages = await parallelMapOrdered(offsets, concurrency, async (offset) => {
    if (delayMs) await sleep(delayMs);
    const body = await requestPage({ resource, apiKey, offset, requestedLimit: effectivePageSize, fetchImpl, retries, timeoutMs });
    validatePage(body, resource, total, offset);
    return body.records;
  });
  const records = [...first.records, ...pages.flat()];
  if (records.length !== total) throw new Error(`Incomplete OGD snapshot: expected ${total} rows, received ${records.length}.`);

  // A final probe detects a publication that changed between the first and last page.
  const finalProbe = await requestPage({ resource, apiKey, offset: 0, requestedLimit: 1, fetchImpl, retries, timeoutMs });
  if (Number(finalProbe.total) !== total || finalProbe.updated !== first.updated) {
    throw new Error("OGD resource changed during download; discard the mixed snapshot and retry.");
  }

  return {
    records,
    metadata: {
      resourceId: resource.id,
      title: resource.title,
      publisher: resource.publisher,
      catalogUrl: resource.catalogUrl,
      resourceUrl: resource.resourceUrl,
      apiUrl: `${API_ORIGIN}/resource/${resource.id}`,
      licenseName: LICENSE_NAME,
      licenseUrl: LICENSE_URL,
      total,
      apiUpdated: first.updated ?? null,
      apiUpdatedDate: first.updated_date ?? null,
      apiVersion: first.version ?? null,
      fields: resource.fields,
      effectivePageSize,
    },
  };
}

function csvCell(value) {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function recordsToCsv(records, fields) {
  return `${[fields, ...records.map((record) => fields.map((field) => record[field]))]
    .map((row) => row.map(csvCell).join(","))
    .join("\n")}\n`;
}

/** Verify that provenance fields still describe the exact allowlisted OGD
 * resource. A checksum alone binds bytes, but without this check a modified
 * manifest could attribute those bytes to a different publisher or licence. */
export function parseOgdDate(value, label = "OGD date") {
  if (value === null || value === undefined || value === "") return null;
  const text = String(value).trim();
  const indianDate = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text);
  const parsed = indianDate
    ? new Date(Date.UTC(Number(indianDate[3]), Number(indianDate[2]) - 1, Number(indianDate[1])))
    : new Date(text);
  if (Number.isNaN(parsed.valueOf())) throw new Error(`${label} is invalid.`);
  if (indianDate && (parsed.getUTCFullYear() !== Number(indianDate[3]) || parsed.getUTCMonth() !== Number(indianDate[2]) - 1 || parsed.getUTCDate() !== Number(indianDate[1]))) {
    throw new Error(`${label} is invalid.`);
  }
  return parsed;
}

export function validateOgdSnapshotManifest(manifest, resourceName, { checksumSha256, recordCount } = {}) {
  const resource = OGD_RESOURCES[resourceName];
  if (!resource) throw new Error(`Unknown OGD resource: ${resourceName}.`);
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) throw new Error("OGD manifest must be a JSON object.");
  if (manifest.schemaVersion !== "architech-ogd-snapshot-v1") throw new Error("Unsupported OGD manifest schema version.");
  if (manifest.resourceId !== resource.id) throw new Error(`Manifest is not for the approved ${resourceName} OGD resource.`);
  if (manifest.title !== resource.title || manifest.publisher !== resource.publisher) throw new Error("OGD manifest title or publisher does not match the approved resource.");
  if (manifest.catalogUrl !== resource.catalogUrl || manifest.resourceUrl !== resource.resourceUrl) throw new Error("OGD manifest source URL does not match the approved resource.");
  if (manifest.apiUrl !== `${API_ORIGIN}/resource/${resource.id}`) throw new Error("OGD manifest API URL does not match the approved resource.");
  if (manifest.licenseName !== LICENSE_NAME || manifest.licenseUrl !== LICENSE_URL) throw new Error("OGD manifest licence does not match the approved GODL terms.");
  if (!Array.isArray(manifest.fields) || manifest.fields.join("|") !== resource.fields.join("|")) throw new Error("OGD manifest field schema does not match the approved resource.");
  if (!Number.isSafeInteger(manifest.recordCount) || manifest.recordCount < resource.minimumRows || manifest.recordCount > resource.maximumRows || manifest.total !== manifest.recordCount) {
    throw new Error("OGD manifest row count is outside the approved range or internally inconsistent.");
  }
  if (recordCount !== undefined && manifest.recordCount !== recordCount) throw new Error("Snapshot row count does not match its OGD manifest.");
  if (!/^[a-f0-9]{64}$/.test(manifest.checksumSha256 ?? "")) throw new Error("OGD manifest checksum is invalid.");
  if (checksumSha256 !== undefined && manifest.checksumSha256 !== checksumSha256) throw new Error("Snapshot checksum does not match its OGD manifest.");
  const retrievedAt = parseOgdDate(manifest.retrievedAt, "OGD manifest retrieval time");
  if (retrievedAt.valueOf() > Date.now() + 5 * 60_000) throw new Error("OGD manifest retrieval time is in the future.");
  parseOgdDate(manifest.apiUpdated || manifest.apiUpdatedDate, "OGD manifest publication/update time");
  if (typeof manifest.attribution !== "string" || !manifest.attribution.includes(resource.publisher) || !manifest.attribution.includes(resource.resourceUrl) || !manifest.attribution.includes(LICENSE_URL)) {
    throw new Error("OGD manifest attribution is missing required publisher, resource, or licence details.");
  }
  return resource;
}

async function atomicWrite(file, content) {
  await mkdir(dirname(file), { recursive: true });
  const temporary = `${file}.partial-${process.pid}`;
  await writeFile(temporary, content, { mode: 0o600 });
  await rename(temporary, file);
}

export async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  if (options.help) {
    console.log("See the usage block at the top of scripts/location/fetch-ogd-snapshot.mjs.");
    return;
  }
  const resourceName = options.resource;
  if (!resourceName || !OGD_RESOURCES[resourceName]) throw new Error("--resource must be india-post or lgd-local-bodies.");
  if (!options.output) throw new Error("--output is required and should normally be under tmp/location/.");
  const output = resolve(options.output);
  const manifestFile = resolve(options.manifest || `${output}.manifest.json`);
  const requestedLimit = parsePositiveInteger(options.pageSize, "--page-size", 100, 1_000);
  const concurrency = parsePositiveInteger(options.concurrency, "--concurrency", 2, 4);
  const delayMs = options.delayMs === "0" ? 0 : parsePositiveInteger(options.delayMs, "--delay-ms", 100, 60_000);

  const snapshot = await downloadOgdResource({
    resourceName,
    apiKey: process.env.DATA_GOV_IN_API_KEY,
    requestedLimit,
    concurrency,
    delayMs,
  });
  const csv = recordsToCsv(snapshot.records, snapshot.metadata.fields);
  const checksumSha256 = createHash("sha256").update(csv).digest("hex");
  const retrievedAt = new Date().toISOString();
  const manifest = {
    schemaVersion: "architech-ogd-snapshot-v1",
    ...snapshot.metadata,
    retrievedAt,
    checksumSha256,
    outputFile: output,
    recordCount: snapshot.records.length,
    attribution: `${snapshot.metadata.publisher}, ${retrievedAt.slice(0, 4)}, ${snapshot.metadata.title}, Open Government Data Platform India, ${snapshot.metadata.apiUpdatedDate ?? retrievedAt.slice(0, 10)}, ${snapshot.metadata.resourceUrl}. Published under ${LICENSE_NAME}: ${LICENSE_URL}.`,
  };
  await atomicWrite(output, csv);
  await atomicWrite(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(JSON.stringify({ output, manifestFile, recordCount: manifest.recordCount, checksumSha256, resourceId: manifest.resourceId }, null, 2));
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : "";
if (invokedPath === import.meta.url) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
