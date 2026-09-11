#!/usr/bin/env node
/** Fail-closed production audit for official India location reference data. */
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
const STATE_SOURCE_KEY = "lgd-state-ut-registry-2026-08-30";
const INDIA_POST_SOURCE_KEY = "india-post-pincode-directory";
const LGD_SOURCE_KEY = "lgd-local-bodies-with-pin-codes";
const DAY_MS = 86_400_000;

function ageDays(value, now) {
  return value ? Math.max(0, Math.floor((now.valueOf() - new Date(value).valueOf()) / DAY_MS)) : null;
}

export async function auditLocationCoverage(prisma, now = new Date()) {
  const [
    stateCount,
    postalCodeCount,
    postOfficeCount,
    postOfficeStates,
    localBodyCount,
    localBodyStates,
    localBodyPostalLinks,
    stateSource,
    postalSource,
    localBodySource,
    runningImports,
  ] = await Promise.all([
    prisma.administrativeArea.count({ where: { type: "STATE_OR_UT", isActive: true, source: { key: STATE_SOURCE_KEY, status: "ACTIVE" } } }),
    prisma.postalCode.count({ where: { isActive: true, postOffices: { some: { isActive: true, source: { key: INDIA_POST_SOURCE_KEY, status: "ACTIVE" } } } } }),
    prisma.postOffice.count({ where: { isActive: true, source: { key: INDIA_POST_SOURCE_KEY, status: "ACTIVE" } } }),
    prisma.postOffice.groupBy({ by: ["administrativeAreaId"], where: { isActive: true, administrativeAreaId: { not: null }, source: { key: INDIA_POST_SOURCE_KEY, status: "ACTIVE" } } }),
    prisma.administrativeArea.count({ where: { type: "LOCAL_BODY", isActive: true, source: { key: LGD_SOURCE_KEY, status: "ACTIVE" } } }),
    prisma.administrativeArea.groupBy({ by: ["parentId"], where: { type: "LOCAL_BODY", isActive: true, parentId: { not: null }, source: { key: LGD_SOURCE_KEY, status: "ACTIVE" } } }),
    prisma.administrativeAreaPostalCode.count({ where: { validTo: null, source: { key: LGD_SOURCE_KEY, status: "ACTIVE" }, administrativeArea: { isActive: true } } }),
    prisma.locationSource.findUnique({ where: { key: STATE_SOURCE_KEY } }),
    prisma.locationSource.findUnique({ where: { key: INDIA_POST_SOURCE_KEY } }),
    prisma.locationSource.findUnique({ where: { key: LGD_SOURCE_KEY } }),
    prisma.locationImportRun.count({ where: { status: "RUNNING", source: { key: { in: [INDIA_POST_SOURCE_KEY, LGD_SOURCE_KEY] } } } }),
  ]);

  const sources = [
    { key: STATE_SOURCE_KEY, row: stateSource, maxAgeDays: 370 },
    { key: INDIA_POST_SOURCE_KEY, row: postalSource, maxAgeDays: 45 },
    { key: LGD_SOURCE_KEY, row: localBodySource, maxAgeDays: 90 },
  ].map(({ key, row, maxAgeDays }) => ({
    key,
    present: row?.status === "ACTIVE",
    retrievedAt: row?.retrievedAt?.toISOString?.() ?? row?.retrievedAt ?? null,
    checksumSha256: row?.checksumSha256 ?? null,
    sourceUrl: row?.sourceUrl ?? null,
    licenseName: row?.licenseName ?? null,
    ageDays: ageDays(row?.retrievedAt, now),
    maxAgeDays,
    fresh: row?.status === "ACTIVE" && Boolean(row?.retrievedAt) && ageDays(row.retrievedAt, now) <= maxAgeDays,
    completeProvenance: row?.status === "ACTIVE" && Boolean(row?.publisher && row?.sourceUrl && row?.licenseName && row?.licenseUrl && row?.attribution && /^[a-f0-9]{64}$/.test(row?.checksumSha256 ?? "")),
  }));

  const counts = {
    statesAndUnionTerritories: stateCount,
    officialPostalCodes: postalCodeCount,
    officialPostOffices: postOfficeCount,
    statesWithPostOffices: postOfficeStates.length,
    officialLocalBodies: localBodyCount,
    statesWithLocalBodies: localBodyStates.length,
    localBodyPostalLinks,
    runningImports,
  };
  const gates = {
    stateRegistryComplete: stateCount === 36,
    postalDirectoryComplete: postOfficeCount >= 150_000 && postalCodeCount >= 18_000 && postOfficeStates.length >= 35,
    localBodyDirectoryComplete: localBodyCount >= 3_000 && localBodyPostalLinks >= 4_000 && localBodyStates.length >= 30,
    sourcesFresh: sources.every((source) => source.fresh),
    provenanceComplete: sources.every((source) => source.completeProvenance),
    noRunningImport: runningImports === 0,
  };
  return { schemaVersion: "architech-location-coverage-audit-v1", checkedAt: now.toISOString(), ready: Object.values(gates).every(Boolean), counts, gates, sources };
}

export async function main(argv = process.argv.slice(2)) {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
  const allowIncomplete = argv.includes("--allow-incomplete");
  const unknown = argv.filter((argument) => argument !== "--allow-incomplete");
  if (unknown.length) throw new Error(`Unknown argument: ${unknown[0]}`);
  const { PrismaClient } = await import("@prisma/client");
  const { PrismaPg } = await import("@prisma/adapter-pg");
  // Prisma 7 clients require a driver adapter.
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
  try {
    const result = await auditLocationCoverage(prisma);
    console.log(JSON.stringify(result, null, 2));
    if (!result.ready && !allowIncomplete) process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : "";
if (import.meta.url === invokedPath) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
