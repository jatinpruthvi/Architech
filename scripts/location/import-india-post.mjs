#!/usr/bin/env node
/**
 * Staged India Post directory importer.
 *
 * Default mode is DRY_RUN and does not need a database. APPLY validates the
 * complete file first, writes a rejection report, records source/import-run
 * provenance, and performs idempotent upserts keyed by source + stable record
 * identity. It never creates product Locality rows from post-office labels:
 * postal offices and neighbourhoods are different concepts and are reconciled
 * later through reviewed LocalityPostalCode links.
 *
 * Usage:
 *   node scripts/location/import-india-post.mjs \
 *     --file /secure/imports/all_india_pin_code.csv \
 *     --source-url https://www.indiapost.gov.in/rti/pincodelist \
 *     --retrieved-at 2026-08-30 \
 *     --report tmp/location/india-post-report.json
 *
 * Add --apply only after reviewing the dry-run report.
 */
import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { officialStateForName } from "./india-state-registry.mjs";
import { parseOgdDate, validateOgdSnapshotManifest } from "./fetch-ogd-snapshot.mjs";

const DEFAULT_SOURCE_KEY = "india-post-pincode-directory";
const DEFAULT_LICENSE_NAME = "Government Open Data License - India";
const DEFAULT_LICENSE_URL = "https://ap.data.gov.in/godl";
const PIN_PATTERN = /^[1-9][0-9]{5}$/;
const DIGIPIN_GRID_BOUNDS = { minLat: 2.5, maxLat: 38.5, minLon: 63.5, maxLon: 99.5 };

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  const input = text.replace(/^\uFEFF/, "");
  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (quoted) {
      if (character === '"' && input[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
      continue;
    }
    if (character === '"') quoted = true;
    else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\n") {
      row.push(field.replace(/\r$/, ""));
      if (row.some((value) => value.trim() !== "")) rows.push(row);
      row = [];
      field = "";
    } else field += character;
  }
  if (quoted) throw new Error("CSV ended inside a quoted field.");
  if (field.length || row.length) {
    row.push(field.replace(/\r$/, ""));
    if (row.some((value) => value.trim() !== "")) rows.push(row);
  }
  return rows;
}

function normalizeHeader(value) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function clean(value) {
  const normalized = String(value ?? "").normalize("NFKC").replace(/\s+/g, " ").trim();
  return /^(na|n\/a|null|undefined|-+)$/i.test(normalized) ? "" : normalized;
}

function field(record, ...candidates) {
  for (const candidate of candidates) {
    const value = record[normalizeHeader(candidate)];
    if (value !== undefined && clean(value)) return clean(value);
  }
  return "";
}

function coordinate(value, min, max, label, errors) {
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    errors.push(`${label} must be a number between ${min} and ${max}.`);
    return null;
  }
  return parsed;
}

function stableRecordId(row) {
  const identity = [row.postalCode, row.name, row.officeType, row.divisionName, row.districtName, row.stateName]
    .map((value) => value?.toLocaleLowerCase("en-IN") ?? "")
    .join("|");
  return createHash("sha256").update(identity).digest("hex");
}

export function normalizeIndiaPostRows(csvText) {
  const matrix = parseCsv(csvText);
  if (matrix.length < 2) throw new Error("CSV must contain a header and at least one data row.");
  const headers = matrix[0].map(normalizeHeader);
  if (new Set(headers).size !== headers.length) throw new Error("CSV contains duplicate normalized column names.");
  const accepted = [];
  const rejected = [];
  const warnings = [];
  const duplicateIds = new Set();

  for (let index = 1; index < matrix.length; index += 1) {
    const values = matrix[index];
    const record = Object.fromEntries(headers.map((header, column) => [header, values[column] ?? ""]));
    const errors = [];
    const qualityIssues = [];
    const postalCode = field(record, "pincode", "pin code", "postal code");
    const name = field(record, "officename", "office name", "post office name", "office");
    const stateName = field(record, "statename", "state name", "state", "state/ut");
    if (!PIN_PATTERN.test(postalCode)) errors.push("PIN must contain exactly six digits and cannot start with zero.");
    if (!name) errors.push("Post-office name is required.");
    if (!stateName) errors.push("State/UT name is required.");
    const officialState = stateName ? officialStateForName(stateName) : null;
    if (stateName && !officialState) errors.push("State/UT name is not present in the official LGD registry.");

    const latitudeText = field(record, "latitude", "lat");
    const longitudeText = field(record, "longitude", "lon", "lng", "long");
    const parsedLatitude = coordinate(latitudeText, DIGIPIN_GRID_BOUNDS.minLat, DIGIPIN_GRID_BOUNDS.maxLat, "Latitude", qualityIssues);
    const parsedLongitude = coordinate(longitudeText, DIGIPIN_GRID_BOUNDS.minLon, DIGIPIN_GRID_BOUNDS.maxLon, "Longitude", qualityIssues);
    if ((parsedLatitude === null) !== (parsedLongitude === null) && (latitudeText || longitudeText)) qualityIssues.push("Latitude and longitude must be supplied as one valid pair; both were omitted.");
    const hasCoordinatePair = parsedLatitude !== null && parsedLongitude !== null;
    const latitude = hasCoordinatePair ? parsedLatitude : null;
    const longitude = hasCoordinatePair ? parsedLongitude : null;

    const normalized = {
      postalCode,
      name,
      officeType: field(record, "officetype", "office type"),
      deliveryStatus: field(record, "delivery", "deliverystatus", "delivery status"),
      circleName: field(record, "circlename", "circle name", "circle"),
      regionName: field(record, "regionname", "region name", "region"),
      divisionName: field(record, "divisionname", "division name", "division"),
      districtName: field(record, "district", "districtname", "district name"),
      stateName: officialState?.name ?? stateName,
      stateLgdCode: officialState?.lgdCode ?? null,
      latitude,
      longitude,
      coordinatePrecision: hasCoordinatePair ? "POST_OFFICE" : "UNKNOWN",
      raw: qualityIssues.length ? { ...record, _architechQualityIssues: qualityIssues } : record,
    };
    const sourceRecordId = stableRecordId(normalized);
    if (duplicateIds.has(sourceRecordId)) errors.push("Duplicate post-office identity within this file.");
    duplicateIds.add(sourceRecordId);

    if (errors.length) rejected.push({ rowNumber: index + 1, errors, raw: record });
    else {
      accepted.push({ ...normalized, sourceRecordId });
      if (qualityIssues.length) warnings.push({ rowNumber: index + 1, issues: qualityIssues, sourceRecordId, rawCoordinates: { latitude: latitudeText, longitude: longitudeText } });
    }
  }
  return { accepted, rejected, warnings, rowsRead: matrix.length - 1 };
}

function parseArgs(argv) {
  const options = { apply: false, replaceFullSnapshot: false, allowRejections: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--apply") options.apply = true;
    else if (argument === "--replace-full-snapshot") options.replaceFullSnapshot = true;
    else if (argument === "--allow-rejections") options.allowRejections = true;
    else if (argument === "--help" || argument === "-h") options.help = true;
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

async function writeJson(file, value) {
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function applyRows(rows, metadata, rejectionReportUri, options) {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required with --apply.");
  const { PrismaClient } = await import("@prisma/client");
  const { PrismaPg } = await import("@prisma/adapter-pg");
  // Prisma 7 clients require a driver adapter.
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
  let run;
  try {
    const concurrentRuns = await prisma.locationImportRun.count({ where: { status: "RUNNING", source: { key: metadata.sourceKey } } });
    if (concurrentRuns) throw new Error(`Another ${metadata.sourceKey} import is already running.`);
    const stateCodes = [...new Set(rows.map((row) => row.stateLgdCode).filter(Boolean))];
    const stateRows = await prisma.administrativeArea.findMany({
      where: { type: "STATE_OR_UT", code: { in: stateCodes }, isActive: true, source: { key: "lgd-state-ut-registry-2026-08-30", status: "ACTIVE" } },
      select: { id: true, code: true },
    });
    const stateIds = new Map(stateRows.map((row) => [row.code, row.id]));
    const missingStates = stateCodes.filter((code) => !stateIds.has(code));
    if (missingStates.length) throw new Error(`Apply the official LGD state migration first; missing LGD codes: ${missingStates.join(", ")}.`);
    const postOfficeData = (row) => {
      const { stateLgdCode, ...data } = row;
      return { ...data, administrativeAreaId: stateIds.get(stateLgdCode) };
    };

    const source = await prisma.locationSource.upsert({
      where: { key: metadata.sourceKey },
      create: {
        key: metadata.sourceKey,
        name: metadata.sourceName,
        publisher: "Department of Posts, Government of India",
        sourceUrl: metadata.sourceUrl,
        downloadUrl: metadata.downloadUrl,
        licenseName: metadata.licenseName,
        licenseUrl: metadata.licenseUrl,
        version: metadata.version,
        checksumSha256: metadata.checksumSha256,
        publishedAt: metadata.publishedAt,
        retrievedAt: metadata.retrievedAt,
        attribution: metadata.attribution || "Department of Posts, Government of India",
        status: "STAGING",
        metadata: { importer: "scripts/location/import-india-post.mjs", schemaVersion: "india-post-post-office-v1" },
      },
      update: {
        sourceUrl: metadata.sourceUrl,
        downloadUrl: metadata.downloadUrl,
        licenseName: metadata.licenseName,
        licenseUrl: metadata.licenseUrl,
        attribution: metadata.attribution || "Department of Posts, Government of India",
        version: metadata.version,
        checksumSha256: metadata.checksumSha256,
        publishedAt: metadata.publishedAt,
        retrievedAt: metadata.retrievedAt,
        status: "STAGING",
      },
    });
    run = await prisma.locationImportRun.create({
      data: {
        sourceId: source.id,
        status: "RUNNING",
        mode: "APPLY",
        sourceUri: metadata.downloadUrl || metadata.sourceUrl,
        checksumSha256: metadata.checksumSha256,
        schemaVersion: "india-post-post-office-v1",
        rowsRead: metadata.rowsRead,
        rowsAccepted: rows.length,
        rowsRejected: metadata.rowsRejected,
        rejectionReportUri,
        metadata: { replaceFullSnapshot: options.replaceFullSnapshot, warningCount: metadata.warningCount },
      },
    });

    const postalCodes = [...new Set(rows.map((row) => row.postalCode))];
    await prisma.postalCode.createMany({
      data: postalCodes.map((code) => ({ code, sourceId: source.id })),
      skipDuplicates: true,
    });

    let inserted = 0;
    let updated = 0;
    const chunkSize = 250;
    for (let offset = 0; offset < rows.length; offset += chunkSize) {
      const chunk = rows.slice(offset, offset + chunkSize);
      const existing = await prisma.postOffice.findMany({
        where: { sourceId: source.id, sourceRecordId: { in: chunk.map((row) => row.sourceRecordId) } },
        select: { sourceRecordId: true },
      });
      const existingIds = new Set(existing.map((row) => row.sourceRecordId));
      inserted += chunk.filter((row) => !existingIds.has(row.sourceRecordId)).length;
      updated += chunk.filter((row) => existingIds.has(row.sourceRecordId)).length;
      await prisma.$transaction(chunk.map((row) => prisma.postOffice.upsert({
        where: { sourceId_sourceRecordId: { sourceId: source.id, sourceRecordId: row.sourceRecordId } },
        create: { ...postOfficeData(row), sourceId: source.id },
        update: { ...postOfficeData(row), isActive: true, validTo: null },
      })));
    }

    let retired = 0;
    if (options.replaceFullSnapshot) {
      const activeIds = new Set(rows.map((row) => row.sourceRecordId));
      const previous = await prisma.postOffice.findMany({
        where: { sourceId: source.id, isActive: true },
        select: { sourceRecordId: true },
      });
      const staleIds = previous.map((row) => row.sourceRecordId).filter((id) => !activeIds.has(id));
      const retiredAt = new Date();
      for (let offset = 0; offset < staleIds.length; offset += 500) {
        const result = await prisma.postOffice.updateMany({
          where: { sourceId: source.id, sourceRecordId: { in: staleIds.slice(offset, offset + 500) } },
          data: { isActive: false, validTo: retiredAt },
        });
        retired += result.count;
      }
    }

    await prisma.$transaction([
      prisma.locationImportRun.update({
        where: { id: run.id },
        data: {
          status: metadata.rowsRejected ? "SUCCEEDED_WITH_REJECTIONS" : "SUCCEEDED",
          completedAt: new Date(),
          rowsInserted: inserted,
          rowsUpdated: updated,
          metadata: { replaceFullSnapshot: options.replaceFullSnapshot, warningCount: metadata.warningCount, retired },
        },
      }),
      prisma.locationSource.update({ where: { id: source.id }, data: { status: "ACTIVE" } }),
    ]);
    return { runId: run.id, sourceId: source.id, inserted, updated, retired };
  } catch (error) {
    if (run) {
      await prisma.locationImportRun.update({
        where: { id: run.id },
        data: { status: "FAILED", completedAt: new Date(), errorSummary: error instanceof Error ? error.message.slice(0, 2000) : String(error).slice(0, 2000) },
      }).catch(() => undefined);
    }
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

export function assessIndiaPostCoverage(rows, rowsRead) {
  const stateCodes = new Set(rows.map((row) => row.stateLgdCode).filter(Boolean));
  const postalCodes = new Set(rows.map((row) => row.postalCode));
  return {
    rowsRead,
    accepted: rows.length,
    stateCount: stateCodes.size,
    uniquePostalCodes: postalCodes.size,
  };
}

function assertProductionCompleteness(coverage) {
  if (coverage.rowsRead < 150_000 || coverage.accepted < 150_000) throw new Error("India Post snapshot is too small to be treated as complete.");
  if (coverage.stateCount < 35) throw new Error(`India Post snapshot covers only ${coverage.stateCount} states/UTs; refusing production activation.`);
  if (coverage.uniquePostalCodes < 18_000) throw new Error(`India Post snapshot contains only ${coverage.uniquePostalCodes} unique PINs; refusing production activation.`);
}

export async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  if (options.help) {
    console.log("See the usage block at the top of scripts/location/import-india-post.mjs.");
    return;
  }
  if (!options.file) throw new Error("--file is required.");
  const inputFile = resolve(options.file);
  const reportFile = resolve(options.report || "tmp/location/india-post-report.json");
  const rejectionFile = resolve(options.rejects || "tmp/location/india-post-rejections.json");
  const warningFile = resolve(options.warnings || "tmp/location/india-post-quality-warnings.json");
  const bytes = await readFile(inputFile);
  const checksumSha256 = createHash("sha256").update(bytes).digest("hex");
  const manifest = options.manifest ? JSON.parse(await readFile(resolve(options.manifest), "utf8")) : null;
  if (!manifest && options.apply) throw new Error("--apply requires an approved --manifest from fetch-ogd-snapshot.mjs.");
  if (!manifest && !options.sourceUrl) throw new Error("--manifest from fetch-ogd-snapshot.mjs or an explicit --source-url is required for dry-run inspection.");

  const { accepted, rejected, warnings, rowsRead } = normalizeIndiaPostRows(bytes.toString("utf8"));
  if (manifest) validateOgdSnapshotManifest(manifest, "india-post", { checksumSha256, recordCount: rowsRead });
  const coverage = assessIndiaPostCoverage(accepted, rowsRead);
  if (manifest || options.replaceFullSnapshot) assertProductionCompleteness(coverage);
  if (options.apply && rejected.length && !options.allowRejections) {
    throw new Error(`India Post snapshot has ${rejected.length} rejected rows; review them or pass --allow-rejections explicitly.`);
  }
  if (options.replaceFullSnapshot && !options.apply) throw new Error("--replace-full-snapshot requires --apply.");
  await writeJson(rejectionFile, { schemaVersion: "india-post-rejections-v1", inputFile, checksumSha256, rejected });
  await writeJson(warningFile, { schemaVersion: "india-post-quality-warnings-v1", inputFile, checksumSha256, warnings });

  const retrievedAt = parseOgdDate(options.retrievedAt || manifest?.retrievedAt || new Date().toISOString(), "--retrieved-at");
  const publicationValue = options.publishedAt || manifest?.apiUpdated || manifest?.apiUpdatedDate;
  const publishedAt = parseOgdDate(publicationValue, "--published-at");
  const metadata = {
    sourceKey: options.sourceKey || DEFAULT_SOURCE_KEY,
    sourceName: options.sourceName || manifest?.title || "India Post PIN code / post-office directory",
    sourceUrl: options.sourceUrl || manifest?.resourceUrl,
    downloadUrl: options.downloadUrl || manifest?.apiUrl || null,
    licenseName: options.licenseName || manifest?.licenseName || DEFAULT_LICENSE_NAME,
    licenseUrl: options.licenseUrl || manifest?.licenseUrl || DEFAULT_LICENSE_URL,
    attribution: options.attribution || manifest?.attribution || null,
    version: options.version || manifest?.apiVersion || manifest?.apiUpdated || manifest?.apiUpdatedDate || null,
    retrievedAt,
    publishedAt,
    checksumSha256,
    rowsRead,
    rowsRejected: rejected.length,
    warningCount: warnings.length,
  };

  const applied = options.apply ? await applyRows(accepted, metadata, rejectionFile, options) : null;
  const report = {
    schemaVersion: "india-post-import-report-v1",
    mode: options.apply ? "APPLY" : "DRY_RUN",
    source: { ...metadata, retrievedAt: retrievedAt.toISOString(), publishedAt: publishedAt?.toISOString() ?? null },
    counts: { ...coverage, rejected: rejected.length, warnings: warnings.length },
    replacementRequested: options.replaceFullSnapshot,
    rejectionReport: rejectionFile,
    qualityWarningReport: warningFile,
    applied,
  };
  await writeJson(reportFile, report);
  console.log(JSON.stringify(report, null, 2));
  if (rejected.length) process.exitCode = 2;
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : "";
if (invokedPath === import.meta.url) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.stack : error);
    process.exitCode = 1;
  });
}
