#!/usr/bin/env node
/**
 * Import the official LGD Urban Local Body ↔ PIN crosswalk.
 *
 * This creates administrative LOCAL_BODY identities and their documented PIN
 * associations. It deliberately does not create product City or Locality rows:
 * municipal jurisdiction, a real-estate market, and a neighbourhood are not
 * interchangeable.
 *
 * Usage (dry-run by default):
 *   pnpm location:import:lgd -- \
 *     --file tmp/location/lgd-local-bodies.csv \
 *     --manifest tmp/location/lgd-local-bodies.csv.manifest.json
 *
 * Add --apply only against a migrated PostgreSQL/PostGIS database.
 */
import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseCsv } from "./import-india-post.mjs";
import { comparableStateName, officialStatesByCode } from "./india-state-registry.mjs";
import { parseOgdDate, validateOgdSnapshotManifest } from "./fetch-ogd-snapshot.mjs";

const RESOURCE_ID = "71818d1a-c114-46cb-aa9b-56ed70d4bc4a";
const SOURCE_KEY = "lgd-local-bodies-with-pin-codes";
const LICENSE_NAME = "Government Open Data License - India";
const LICENSE_URL = "https://ap.data.gov.in/godl";
const PIN_PATTERN = /^[1-9][0-9]{5}$/;

function clean(value) {
  const normalized = String(value ?? "").normalize("NFKC").replace(/\s+/g, " ").trim();
  return /^(na|n\/a|null|undefined|-+)$/i.test(normalized) ? "" : normalized;
}

function header(value) {
  return clean(value).toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function normalizeLgdLocalBodyRows(csvText) {
  const matrix = parseCsv(csvText);
  if (matrix.length < 2) throw new Error("CSV must contain a header and at least one data row.");
  const headers = matrix[0].map(header);
  const required = ["statecode", "statenameenglish", "localbodycode", "localbodynameenglish", "localbodytypename", "pincode"];
  if (!required.every((field) => headers.includes(field))) throw new Error("LGD local-body CSV schema does not match the approved six fields.");
  if (new Set(headers).size !== headers.length) throw new Error("CSV contains duplicate normalized column names.");

  const accepted = [];
  const rejected = [];
  const seenLinks = new Set();
  const bodies = new Map();
  for (let index = 1; index < matrix.length; index += 1) {
    const values = matrix[index];
    const record = Object.fromEntries(headers.map((key, column) => [key, clean(values[column])]));
    const errors = [];
    const stateCode = String(Number(record.statecode));
    const localBodyCode = String(Number(record.localbodycode));
    const postalCode = record.pincode;
    const state = officialStatesByCode.get(stateCode);
    if (!/^\d+$/.test(record.statecode) || !state) errors.push("State code must exist in the official 36-entry LGD registry.");
    if (!record.statenameenglish) errors.push("State name is required.");
    else if (state && comparableStateName(record.statenameenglish) !== comparableStateName(state.name)) errors.push("State name does not match its LGD code.");
    if (!/^\d+$/.test(record.localbodycode) || Number(localBodyCode) < 1) errors.push("Local body code must be a positive LGD code.");
    if (!record.localbodynameenglish) errors.push("Local body name is required.");
    if (!record.localbodytypename) errors.push("Local body type is required.");
    if (!PIN_PATTERN.test(postalCode)) errors.push("PIN must contain exactly six digits and cannot start with zero.");

    const linkKey = `${localBodyCode}:${postalCode}`;
    if (seenLinks.has(linkKey)) errors.push("Duplicate local-body/PIN identity within this snapshot.");
    seenLinks.add(linkKey);

    const bodyIdentity = `${stateCode}|${record.localbodynameenglish}|${record.localbodytypename}`;
    const previousBody = bodies.get(localBodyCode);
    if (previousBody && previousBody !== bodyIdentity) errors.push("One LGD local-body code has conflicting state, name, or type values.");
    else bodies.set(localBodyCode, bodyIdentity);

    if (errors.length) rejected.push({ rowNumber: index + 1, errors, raw: record });
    else accepted.push({
      stateCode,
      stateName: state.name,
      suppliedStateName: record.statenameenglish,
      localBodyCode,
      localBodyName: record.localbodynameenglish,
      localBodyType: record.localbodytypename,
      postalCode,
    });
  }
  return { accepted, rejected, rowsRead: matrix.length - 1 };
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

function assertProductionCompleteness(rows, rowsRead) {
  const stateCodes = new Set(rows.map((row) => row.stateCode));
  const bodies = new Set(rows.map((row) => row.localBodyCode));
  const pins = new Set(rows.map((row) => row.postalCode));
  if (rowsRead < 4_000 || rows.length < 4_000) throw new Error("LGD snapshot is too small to be treated as complete.");
  if (stateCodes.size < 30) throw new Error(`LGD snapshot covers only ${stateCodes.size} states/UTs; refusing full replacement.`);
  if (bodies.size < 3_000) throw new Error(`LGD snapshot contains only ${bodies.size} local bodies; refusing full replacement.`);
  if (pins.size < 3_000) throw new Error(`LGD snapshot contains only ${pins.size} PINs; refusing full replacement.`);
  return { stateCount: stateCodes.size, localBodyCount: bodies.size, uniquePostalCodes: pins.size };
}

async function applyRows(rows, metadata, options) {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required with --apply.");
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  let run;
  try {
    const concurrentRuns = await prisma.locationImportRun.count({ where: { status: "RUNNING", source: { key: SOURCE_KEY } } });
    if (concurrentRuns) throw new Error(`Another ${SOURCE_KEY} import is already running.`);
    const stateRows = await prisma.administrativeArea.findMany({
      where: { type: "STATE_OR_UT", code: { in: [...new Set(rows.map((row) => row.stateCode))] }, isActive: true, source: { key: "lgd-state-ut-registry-2026-08-30", status: "ACTIVE" } },
      select: { id: true, code: true },
    });
    const stateIds = new Map(stateRows.map((row) => [row.code, row.id]));
    const missingStates = [...new Set(rows.map((row) => row.stateCode))].filter((code) => !stateIds.has(code));
    if (missingStates.length) throw new Error(`Apply the official LGD state migration first; missing LGD codes: ${missingStates.join(", ")}.`);

    const source = await prisma.locationSource.upsert({
      where: { key: SOURCE_KEY },
      create: {
        key: SOURCE_KEY,
        name: metadata.title,
        publisher: metadata.publisher,
        sourceUrl: metadata.resourceUrl,
        downloadUrl: metadata.apiUrl,
        licenseName: metadata.licenseName,
        licenseUrl: metadata.licenseUrl,
        attribution: metadata.attribution,
        version: metadata.version,
        checksumSha256: metadata.checksumSha256,
        publishedAt: metadata.publishedAt ? new Date(metadata.publishedAt) : null,
        retrievedAt: new Date(metadata.retrievedAt),
        status: "STAGING",
        metadata: { resourceId: RESOURCE_ID, schemaVersion: "lgd-local-body-pin-v1" },
      },
      update: {
        sourceUrl: metadata.resourceUrl,
        downloadUrl: metadata.apiUrl,
        licenseName: metadata.licenseName,
        licenseUrl: metadata.licenseUrl,
        attribution: metadata.attribution,
        version: metadata.version,
        checksumSha256: metadata.checksumSha256,
        publishedAt: metadata.publishedAt ? new Date(metadata.publishedAt) : null,
        retrievedAt: new Date(metadata.retrievedAt),
        status: "STAGING",
      },
    });
    run = await prisma.locationImportRun.create({
      data: {
        sourceId: source.id,
        status: "RUNNING",
        mode: "APPLY",
        sourceUri: metadata.apiUrl,
        checksumSha256: metadata.checksumSha256,
        schemaVersion: "lgd-local-body-pin-v1",
        rowsRead: metadata.rowsRead,
        rowsAccepted: rows.length,
        rowsRejected: metadata.rowsRejected,
        rejectionReportUri: metadata.rejectionReport,
        metadata: { replaceFullSnapshot: options.replaceFullSnapshot },
      },
    });

    const postalCodes = [...new Set(rows.map((row) => row.postalCode))];
    await prisma.postalCode.createMany({ data: postalCodes.map((code) => ({ code, sourceId: source.id })), skipDuplicates: true });

    const uniqueBodies = [...new Map(rows.map((row) => [row.localBodyCode, row])).values()];
    const areaIds = new Map();
    let inserted = 0;
    let updated = 0;
    for (let offset = 0; offset < uniqueBodies.length; offset += 200) {
      const chunk = uniqueBodies.slice(offset, offset + 200);
      const existing = await prisma.administrativeArea.findMany({
        where: { sourceId: source.id, type: "LOCAL_BODY", code: { in: chunk.map((row) => row.localBodyCode) } },
        select: { id: true, code: true },
      });
      const existingCodes = new Set(existing.map((row) => row.code));
      inserted += chunk.filter((row) => !existingCodes.has(row.localBodyCode)).length;
      updated += chunk.filter((row) => existingCodes.has(row.localBodyCode)).length;
      const results = await prisma.$transaction(chunk.map((row) => prisma.administrativeArea.upsert({
        where: { sourceId_type_code: { sourceId: source.id, type: "LOCAL_BODY", code: row.localBodyCode } },
        create: {
          type: "LOCAL_BODY",
          code: row.localBodyCode,
          name: row.localBodyName,
          slug: `${row.localBodyCode}-${row.localBodyName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")}`,
          subtype: row.localBodyType,
          metadata: { stateCode: row.stateCode, suppliedStateName: row.suppliedStateName },
          parentId: stateIds.get(row.stateCode),
          sourceId: source.id,
          sourceFeatureId: `local-body:${row.localBodyCode}`,
          validFrom: metadata.publishedAt ? new Date(metadata.publishedAt) : null,
        },
        update: {
          name: row.localBodyName,
          subtype: row.localBodyType,
          metadata: { stateCode: row.stateCode, suppliedStateName: row.suppliedStateName },
          parentId: stateIds.get(row.stateCode),
          sourceFeatureId: `local-body:${row.localBodyCode}`,
          validTo: null,
          isActive: true,
        },
        select: { id: true, code: true },
      })));
      for (const result of results) areaIds.set(result.code, result.id);
    }

    for (let offset = 0; offset < rows.length; offset += 200) {
      const chunk = rows.slice(offset, offset + 200);
      await prisma.$transaction(chunk.map((row) => prisma.administrativeAreaPostalCode.upsert({
        where: {
          administrativeAreaId_postalCode_sourceId: {
            administrativeAreaId: areaIds.get(row.localBodyCode),
            postalCode: row.postalCode,
            sourceId: source.id,
          },
        },
        create: {
          administrativeAreaId: areaIds.get(row.localBodyCode),
          postalCode: row.postalCode,
          sourceId: source.id,
          confidence: 1,
          evidence: { resourceId: RESOURCE_ID, relationship: "LGD urban local body with PIN code" },
          validFrom: metadata.publishedAt ? new Date(metadata.publishedAt) : null,
        },
        update: {
          confidence: 1,
          evidence: { resourceId: RESOURCE_ID, relationship: "LGD urban local body with PIN code" },
          validTo: null,
        },
      })));
    }

    let retiredLinks = 0;
    let retiredBodies = 0;
    if (options.replaceFullSnapshot) {
      const activeKeys = new Set(rows.map((row) => `${areaIds.get(row.localBodyCode)}:${row.postalCode}`));
      const previousLinks = await prisma.administrativeAreaPostalCode.findMany({
        where: { sourceId: source.id, validTo: null },
        select: { administrativeAreaId: true, postalCode: true },
      });
      const staleLinks = previousLinks.filter((link) => !activeKeys.has(`${link.administrativeAreaId}:${link.postalCode}`));
      for (let offset = 0; offset < staleLinks.length; offset += 200) {
        const now = new Date();
        const chunk = staleLinks.slice(offset, offset + 200);
        await prisma.$transaction(chunk.map((link) => prisma.administrativeAreaPostalCode.update({
          where: { administrativeAreaId_postalCode_sourceId: { ...link, sourceId: source.id } },
          data: { validTo: now },
        })));
      }
      retiredLinks = staleLinks.length;
      const activeBodyCodes = new Set(uniqueBodies.map((row) => row.localBodyCode));
      const previousBodies = await prisma.administrativeArea.findMany({ where: { sourceId: source.id, type: "LOCAL_BODY", isActive: true }, select: { id: true, code: true } });
      const staleBodies = previousBodies.filter((area) => !area.code || !activeBodyCodes.has(area.code));
      for (let offset = 0; offset < staleBodies.length; offset += 200) {
        const now = new Date();
        await prisma.$transaction(staleBodies.slice(offset, offset + 200).map((area) => prisma.administrativeArea.update({ where: { id: area.id }, data: { isActive: false, validTo: now } })));
      }
      retiredBodies = staleBodies.length;
    }

    await prisma.$transaction([
      prisma.locationImportRun.update({
        where: { id: run.id },
        data: { status: metadata.rowsRejected ? "SUCCEEDED_WITH_REJECTIONS" : "SUCCEEDED", completedAt: new Date(), rowsInserted: inserted, rowsUpdated: updated, metadata: { replaceFullSnapshot: options.replaceFullSnapshot, retiredLinks, retiredBodies } },
      }),
      prisma.locationSource.update({ where: { id: source.id }, data: { status: "ACTIVE" } }),
    ]);
    return { runId: run.id, sourceId: source.id, inserted, updated, retiredLinks, retiredBodies };
  } catch (error) {
    if (run) await prisma.locationImportRun.update({ where: { id: run.id }, data: { status: "FAILED", completedAt: new Date(), errorSummary: String(error).slice(0, 2_000) } }).catch(() => undefined);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

export async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  if (options.help) {
    console.log("See the usage block at the top of scripts/location/import-lgd-local-bodies.mjs.");
    return;
  }
  if (!options.file) throw new Error("--file is required.");
  if (!options.manifest) throw new Error("--manifest from fetch-ogd-snapshot.mjs is required.");
  const inputFile = resolve(options.file);
  const manifestFile = resolve(options.manifest);
  const reportFile = resolve(options.report || "tmp/location/lgd-local-body-import-report.json");
  const rejectionFile = resolve(options.rejects || "tmp/location/lgd-local-body-rejections.json");
  const [bytes, manifestText] = await Promise.all([readFile(inputFile), readFile(manifestFile, "utf8")]);
  const manifest = JSON.parse(manifestText);
  const checksumSha256 = createHash("sha256").update(bytes).digest("hex");
  const normalized = normalizeLgdLocalBodyRows(bytes.toString("utf8"));
  validateOgdSnapshotManifest(manifest, "lgd-local-bodies", { checksumSha256, recordCount: normalized.rowsRead });
  const coverage = assertProductionCompleteness(normalized.accepted, normalized.rowsRead);
  if (options.apply && normalized.rejected.length && !options.allowRejections) {
    throw new Error(`LGD snapshot has ${normalized.rejected.length} rejected rows; review them or pass --allow-rejections explicitly.`);
  }
  if (options.replaceFullSnapshot && !options.apply) throw new Error("--replace-full-snapshot requires --apply.");
  await writeJson(rejectionFile, { schemaVersion: "lgd-local-body-rejections-v1", checksumSha256, rejected: normalized.rejected });
  const publishedAt = parseOgdDate(manifest.apiUpdated || manifest.apiUpdatedDate, "OGD manifest publication/update time");
  const metadata = {
    ...manifest,
    version: manifest.apiVersion || manifest.apiUpdated || manifest.apiUpdatedDate || null,
    publishedAt: publishedAt?.toISOString() ?? null,
    checksumSha256,
    rowsRead: normalized.rowsRead,
    rowsRejected: normalized.rejected.length,
    rejectionReport: rejectionFile,
  };
  const applied = options.apply ? await applyRows(normalized.accepted, metadata, options) : null;
  const report = {
    schemaVersion: "lgd-local-body-import-report-v1",
    mode: options.apply ? "APPLY" : "DRY_RUN",
    source: { resourceId: RESOURCE_ID, checksumSha256, retrievedAt: manifest.retrievedAt, licenseName: manifest.licenseName, licenseUrl: manifest.licenseUrl },
    counts: { rowsRead: normalized.rowsRead, accepted: normalized.accepted.length, rejected: normalized.rejected.length, ...coverage },
    replacementRequested: options.replaceFullSnapshot,
    rejectionReport: rejectionFile,
    applied,
  };
  await writeJson(reportFile, report);
  console.log(JSON.stringify(report, null, 2));
  if (normalized.rejected.length) process.exitCode = 2;
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : "";
if (invokedPath === import.meta.url) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
