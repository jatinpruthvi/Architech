import "server-only";
import { INDIA_STATES_AND_UTS, INDIA_STATE_REGISTRY_SOURCE } from "@/lib/location/india-states";
import { getPrismaClient } from "@/lib/repositories/server/prisma";
import { isPrismaDataSource } from "@/lib/repositories/source";

const STATE_SOURCE_KEY = "lgd-state-ut-registry-2026-08-30";
const INDIA_POST_SOURCE_KEY = "india-post-pincode-directory";
const LGD_SOURCE_KEY = "lgd-local-bodies-with-pin-codes";
const STATE_REGISTRY_CHECKSUM = "7e1f421512b11b92696364d1ce3508f5da050bd81c1f0f0a9d24b3eaf94d3aa9";

export const PRODUCTION_LOCATION_THRESHOLDS = {
  stateOrUtCount: 36,
  postalCodeCount: 18_000,
  postOfficeCount: 150_000,
  statesWithPostOffices: 35,
  localBodyCount: 3_000,
  localBodyPostalLinkCount: 4_000,
  statesWithLocalBodies: 30,
  maximumStateRegistryAgeDays: 370,
  maximumPostalSourceAgeDays: 45,
  maximumLocalBodySourceAgeDays: 90,
} as const;

export type IndiaLocationCoverage = {
  mode: "reference-only" | "prisma";
  status: "ready" | "incomplete";
  checkedAt: string;
  totals: {
    stateOrUtCount: number;
    postalCodeCount: number;
    postOfficeCount: number;
    statesWithPostOffices: number;
    localBodyCount: number;
    localBodyPostalLinkCount: number;
    statesWithLocalBodies: number;
  };
  states: Array<{
    lgdCode: string;
    name: string;
    nativeName: string;
    kind: "STATE" | "UT";
    slug: string;
    postalOfficeCount: number;
    localBodyCount: number;
  }>;
  sources: {
    stateRegistry: PublicCoverageSource | null;
    postalDirectory: PublicCoverageSource | null;
    localBodyDirectory: PublicCoverageSource | null;
  };
  gates: {
    stateRegistryComplete: boolean;
    postalDirectoryComplete: boolean;
    localBodyDirectoryComplete: boolean;
    sourcesFresh: boolean;
  };
  disclaimer: string;
};

export type PublicCoverageSource = {
  key: string;
  name: string;
  publisher: string;
  sourceUrl: string;
  licenseName: string | null;
  licenseUrl: string | null;
  attribution: string | null;
  version: string | null;
  checksumSha256: string | null;
  retrievedAt: string;
  ageDays: number;
  fresh: boolean;
};

type SourceRecord = Omit<PublicCoverageSource, "retrievedAt" | "ageDays" | "fresh"> & { retrievedAt: Date | string };

type CoverageStateRow = {
  id: string;
  code: string | null;
  name: string;
  nativeName: string | null;
  slug: string | null;
  subtype: string | null;
};

type CoveragePrismaClient = {
  administrativeArea: {
    findMany(args: unknown): Promise<CoverageStateRow[]>;
    count(args: unknown): Promise<number>;
    groupBy(args: unknown): Promise<Array<{ parentId: string | null; _count: { _all: number } }>>;
  };
  postalCode: { count(args: unknown): Promise<number> };
  postOffice: {
    count(args: unknown): Promise<number>;
    groupBy(args: unknown): Promise<Array<{ administrativeAreaId: string | null; _count: { _all: number } }>>;
  };
  administrativeAreaPostalCode: { count(args: unknown): Promise<number> };
  locationSource: { findFirst(args: unknown): Promise<SourceRecord | null> };
};

function ageDays(date: Date | string, now: Date) {
  return Math.max(0, (now.getTime() - new Date(date).getTime()) / 86_400_000);
}

function publicSource(source: SourceRecord | null, now: Date, maximumAgeDays: number): PublicCoverageSource | null {
  if (!source) return null;
  const age = ageDays(source.retrievedAt, now);
  return { ...source, retrievedAt: new Date(source.retrievedAt).toISOString(), ageDays: Math.floor(age), fresh: age <= maximumAgeDays };
}

function referenceStateSource(now: Date): PublicCoverageSource {
  const age = ageDays(INDIA_STATE_REGISTRY_SOURCE.retrievedAt, now);
  return {
    key: STATE_SOURCE_KEY,
    name: INDIA_STATE_REGISTRY_SOURCE.datasetName,
    publisher: INDIA_STATE_REGISTRY_SOURCE.publisher,
    sourceUrl: INDIA_STATE_REGISTRY_SOURCE.sourceUrl,
    licenseName: INDIA_STATE_REGISTRY_SOURCE.licenseName,
    licenseUrl: INDIA_STATE_REGISTRY_SOURCE.licenseUrl,
    attribution: INDIA_STATE_REGISTRY_SOURCE.attribution,
    version: "2026-08-30",
    checksumSha256: STATE_REGISTRY_CHECKSUM,
    retrievedAt: new Date(INDIA_STATE_REGISTRY_SOURCE.retrievedAt).toISOString(),
    ageDays: Math.floor(age),
    fresh: age <= PRODUCTION_LOCATION_THRESHOLDS.maximumStateRegistryAgeDays,
  };
}

export async function getIndiaLocationCoverageForServer(now = new Date()): Promise<IndiaLocationCoverage> {
  if (!isPrismaDataSource()) {
    const stateRegistry = referenceStateSource(now);
    return {
      mode: "reference-only",
      status: "incomplete",
      checkedAt: now.toISOString(),
      totals: {
        stateOrUtCount: INDIA_STATES_AND_UTS.length,
        postalCodeCount: 0,
        postOfficeCount: 0,
        statesWithPostOffices: 0,
        localBodyCount: 0,
        localBodyPostalLinkCount: 0,
        statesWithLocalBodies: 0,
      },
      states: INDIA_STATES_AND_UTS.map((state) => ({
        lgdCode: state.lgdCode,
        name: state.name,
        nativeName: state.nativeName,
        kind: state.kind,
        slug: state.slug,
        postalOfficeCount: 0,
        localBodyCount: 0,
      })),
      sources: { stateRegistry, postalDirectory: null, localBodyDirectory: null },
      gates: {
        stateRegistryComplete: INDIA_STATES_AND_UTS.length === PRODUCTION_LOCATION_THRESHOLDS.stateOrUtCount,
        postalDirectoryComplete: false,
        localBodyDirectoryComplete: false,
        sourcesFresh: false,
      },
      disclaimer: "The official State/UT identity registry is available, but nationwide India Post and LGD bulk snapshots require the activated Prisma production database.",
    };
  }

  const prisma = getPrismaClient() as unknown as CoveragePrismaClient;
  const [
    stateRows,
    postalCodeCount,
    postOfficeCount,
    postOfficeGroups,
    localBodyCount,
    localBodyGroups,
    localBodyPostalLinkCount,
    stateSource,
    postalSource,
    localBodySource,
  ] = await Promise.all([
    prisma.administrativeArea.findMany({
      where: { type: "STATE_OR_UT", isActive: true, source: { key: STATE_SOURCE_KEY, status: "ACTIVE" } },
      select: { id: true, code: true, name: true, nativeName: true, slug: true, subtype: true },
      orderBy: { name: "asc" },
    }),
    prisma.postalCode.count({
      where: { isActive: true, postOffices: { some: { isActive: true, source: { key: INDIA_POST_SOURCE_KEY, status: "ACTIVE" } } } },
    }),
    prisma.postOffice.count({ where: { isActive: true, source: { key: INDIA_POST_SOURCE_KEY, status: "ACTIVE" } } }),
    prisma.postOffice.groupBy({
      by: ["administrativeAreaId"],
      where: { isActive: true, administrativeAreaId: { not: null }, source: { key: INDIA_POST_SOURCE_KEY, status: "ACTIVE" } },
      _count: { _all: true },
    }),
    prisma.administrativeArea.count({ where: { type: "LOCAL_BODY", isActive: true, source: { key: LGD_SOURCE_KEY, status: "ACTIVE" } } }),
    prisma.administrativeArea.groupBy({
      by: ["parentId"],
      where: { type: "LOCAL_BODY", isActive: true, parentId: { not: null }, source: { key: LGD_SOURCE_KEY, status: "ACTIVE" } },
      _count: { _all: true },
    }),
    prisma.administrativeAreaPostalCode.count({
      where: { validTo: null, source: { key: LGD_SOURCE_KEY, status: "ACTIVE" }, administrativeArea: { isActive: true } },
    }),
    prisma.locationSource.findFirst({ where: { key: STATE_SOURCE_KEY, status: "ACTIVE" } }),
    prisma.locationSource.findFirst({ where: { key: INDIA_POST_SOURCE_KEY, status: "ACTIVE" } }),
    prisma.locationSource.findFirst({ where: { key: LGD_SOURCE_KEY, status: "ACTIVE" } }),
  ]);

  const postOfficesByState = new Map(postOfficeGroups.map((group) => [group.administrativeAreaId, group._count._all]));
  const localBodiesByState = new Map(localBodyGroups.map((group) => [group.parentId, group._count._all]));
  const statesWithPostOffices = stateRows.filter((state) => (postOfficesByState.get(state.id) ?? 0) > 0).length;
  const statesWithLocalBodies = stateRows.filter((state) => (localBodiesByState.get(state.id) ?? 0) > 0).length;
  const publicStateSource = publicSource(stateSource, now, PRODUCTION_LOCATION_THRESHOLDS.maximumStateRegistryAgeDays);
  const publicPostalSource = publicSource(postalSource, now, PRODUCTION_LOCATION_THRESHOLDS.maximumPostalSourceAgeDays);
  const publicLocalBodySource = publicSource(localBodySource, now, PRODUCTION_LOCATION_THRESHOLDS.maximumLocalBodySourceAgeDays);
  const gates = {
    stateRegistryComplete: stateRows.length === PRODUCTION_LOCATION_THRESHOLDS.stateOrUtCount,
    postalDirectoryComplete:
      postalCodeCount >= PRODUCTION_LOCATION_THRESHOLDS.postalCodeCount
      && postOfficeCount >= PRODUCTION_LOCATION_THRESHOLDS.postOfficeCount
      && statesWithPostOffices >= PRODUCTION_LOCATION_THRESHOLDS.statesWithPostOffices,
    localBodyDirectoryComplete:
      localBodyCount >= PRODUCTION_LOCATION_THRESHOLDS.localBodyCount
      && localBodyPostalLinkCount >= PRODUCTION_LOCATION_THRESHOLDS.localBodyPostalLinkCount
      && statesWithLocalBodies >= PRODUCTION_LOCATION_THRESHOLDS.statesWithLocalBodies,
    sourcesFresh: Boolean(publicStateSource?.fresh && publicPostalSource?.fresh && publicLocalBodySource?.fresh),
  };
  const ready = Object.values(gates).every(Boolean);

  return {
    mode: "prisma",
    status: ready ? "ready" : "incomplete",
    checkedAt: now.toISOString(),
    totals: {
      stateOrUtCount: stateRows.length,
      postalCodeCount,
      postOfficeCount,
      statesWithPostOffices,
      localBodyCount,
      localBodyPostalLinkCount,
      statesWithLocalBodies,
    },
    states: stateRows.map((state) => ({
      lgdCode: state.code ?? "",
      name: state.name,
      nativeName: state.nativeName ?? state.name,
      kind: state.subtype === "Union Territory" ? "UT" : "STATE",
      slug: state.slug ?? "",
      postalOfficeCount: postOfficesByState.get(state.id) ?? 0,
      localBodyCount: localBodiesByState.get(state.id) ?? 0,
    })),
    sources: { stateRegistry: publicStateSource, postalDirectory: publicPostalSource, localBodyDirectory: publicLocalBodySource },
    gates,
    disclaimer: "Postal, administrative, product-locality, geometry, and exact-address coverage are separate. Passing these gates does not assert that every PIN maps to one locality or that every jurisdiction has active property inventory.",
  };
}
