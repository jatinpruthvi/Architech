import "server-only";
import { createRequire } from "node:module";
import { dbListingToProperty, dbLocalityToLocality } from "@/lib/repositories/mappers";
import { getListings, getListingById, getListingsByLocality, getListingStaticParams, getLocalities, getLocalityBySlug, getCities, type City } from "@/lib/repositories";
import {
  dbOrganizationToPublicAgent,
  demoDirectoryAgents,
  isPublicVerification,
  type PublicAgentOrganization,
} from "@/lib/agent/directory";
import { isPrismaDataSource } from "@/lib/repositories/source";

type PrismaClientLike = {
  listing: {
    findMany(args: unknown): Promise<unknown[]>;
    findFirst(args: unknown): Promise<unknown | null>;
  };
  locality: {
    findMany(args: unknown): Promise<unknown[]>;
    findFirst(args: unknown): Promise<unknown | null>;
  };
  city: {
    findMany(args: unknown): Promise<unknown[]>;
  };
  brokerOrganization: {
    findMany(args: unknown): Promise<unknown[]>;
    findFirst(args: unknown): Promise<unknown | null>;
  };
};

declare global {
  var __architechPrisma: PrismaClientLike | undefined;
}

function loadPrismaClientConstructor(): new (options?: unknown) => PrismaClientLike {
  const require = createRequire(import.meta.url);
  const clientModule = require("@prisma/client") as { PrismaClient?: new (options?: unknown) => PrismaClientLike };
  if (!clientModule.PrismaClient) {
    throw new Error("PrismaClient is not generated. Run `pnpm db:generate` before using ARCHITECH_DATA_SOURCE=prisma.");
  }
  return clientModule.PrismaClient;
}

export function getPrismaClient() {
  if (!globalThis.__architechPrisma) {
    const PrismaClient = loadPrismaClientConstructor();
    // Prisma 7 clients require a driver adapter; the pg adapter connects
    // through DATABASE_URL (the same URL `prisma migrate deploy` uses).
    const require = createRequire(import.meta.url);
    const { PrismaPg } = require("@prisma/adapter-pg") as {
      PrismaPg: new (options: { connectionString: string }) => unknown;
    };
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL is required when ARCHITECH_DATA_SOURCE=prisma.");
    }
    globalThis.__architechPrisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  }
  return globalThis.__architechPrisma;
}

const listingInclude = {
  city: true,
  locality: true,
  media: { orderBy: { sortOrder: "asc" as const }, take: 1 },
};

export type ListingScope = {
  /** Narrow to one city slug. Unscoped reads are the expensive case. */
  citySlug?: string;
  /**
   * Hard ceiling on rows read. A nationwide search with no scope must not be
   * able to pull the whole table into memory; when the ceiling is reached the
   * caller reports a bounded result rather than pretending it is complete.
   */
  limit?: number;
};

export const MAX_UNSCOPED_LISTING_ROWS = 5000;

/**
 * Static params for `/listing/[id]` — audit P0.5.
 *
 * Fixture mode returns the reference catalogue (build-safe, no DB). Prisma
 * mode returns every listing's `stableId` and `slug`, so listings created in
 * the database become pre-rendered ISR pages at deploy time instead of paying
 * per-request SSR forever. A build without a reachable database (CI, some
 * edge deploys) must not fail: the lookup is best-effort and falls back to
 * the fixture ids, which keeps `dynamicParams` serving unknown ids on demand.
 */
export async function getListingStaticParamsForServer(): Promise<Array<{ id: string }>> {
  const fallback = getListingStaticParams();
  if (!isPrismaDataSource()) return fallback;
  try {
    const prisma = getPrismaClient();
    const rows = (await prisma.listing.findMany({ select: { stableId: true, slug: true } })) as Array<{ stableId: string; slug: string }>;
    const ids = new Set<string>();
    for (const row of rows) {
      if (row.stableId) ids.add(row.stableId);
      if (row.slug) ids.add(row.slug);
    }
    return ids.size > 0 ? [...ids].map((id) => ({ id })) : fallback;
  } catch {
    return fallback;
  }
}

/**
 * Read the active inventory for a scope.
 *
 * Before the facet rebuild this issued `findMany({ where: { lifecycle } })`
 * with no scope and no bound, and every caller then filtered the result in JS —
 * i.e. one unbounded table read per search, growing with the feed. The city is
 * now pushed into the query and an explicit ceiling caps the nationwide case.
 */
export async function getListingsForServer(scope: ListingScope & { narrowToIds?: string[] } = {}) {
  /* Every read — city-scoped or not — gets the same ceiling and the same
     stable ordering. Before this, a city-scoped read omitted `take` entirely
     and could pull an entire city table into memory while the nationwide read
     was capped; two paths that disagree on their own limits is how a capped
     result silently becomes an unbounded one. */
  const ceiling = scope.limit ?? MAX_UNSCOPED_LISTING_ROWS;
  if (!isPrismaDataSource()) {
    const all = getListings();
    const narrowed = scope.narrowToIds ? all.filter((listing) => scope.narrowToIds!.includes(listing.id)) : all;
    const cityScoped = scope.citySlug ? narrowed.filter((listing) => listing.citySlug === scope.citySlug) : narrowed;
    return cityScoped.slice(0, ceiling);
  }
  /* An executed SQL narrowing that produced ZERO candidates is authoritative
     (the candidates are a superset of what the JS filter would keep — see
     buildSqlNarrowPlan), so the read is skipped entirely. */
  if (scope.narrowToIds && scope.narrowToIds.length === 0) return [];
  const prisma = getPrismaClient();
  const rows = await prisma.listing.findMany({
    where: {
      lifecycle: "ACTIVE",
      ...(scope.citySlug ? { city: { slug: scope.citySlug } } : {}),
      ...(scope.narrowToIds ? { id: { in: scope.narrowToIds } } : {}),
    },
    include: listingInclude,
    orderBy: { meaningfulUpdatedAt: "desc" },
    take: ceiling,
  });
  return rows.map((row) => dbListingToProperty(row as Parameters<typeof dbListingToProperty>[0]));
}

/** Featured-first selection, same contract as the fixture getFeaturedListings:
    featured homes lead, the rest fill to the limit. */
export async function getFeaturedListingsForServer(limit = 8, citySlug?: string) {
  const pool = await getListingsForServer({ citySlug });
  const featured = pool.filter((property) => property.featured);
  return [...featured, ...pool.filter((property) => !property.featured)].slice(0, limit);
}

/* ---- public agent directory ------------------------------------------------ */

type DbOrganizationRow = {
  slug: string;
  name: string;
  verificationStatus: string;
  reraNumber?: string | null;
  website?: string | null;
  city?: { slug: string; name: string } | null;
  _count?: { listings?: number };
};

function organizationRowToPublicAgent(row: DbOrganizationRow): PublicAgentOrganization {
  return dbOrganizationToPublicAgent({
    slug: row.slug,
    name: row.name,
    citySlug: row.city?.slug ?? "ahmedabad",
    cityName: row.city?.name ?? "Ahmedabad",
    verificationStatus: row.verificationStatus,
    reraNumber: row.reraNumber,
    website: row.website,
    listingCount: row._count?.listings ?? 0,
  });
}

/** Public directory: every organization whose verification tier is public. */
export async function getAgentDirectoryForServer(): Promise<PublicAgentOrganization[]> {
  if (!isPrismaDataSource()) return demoDirectoryAgents();
  const prisma = getPrismaClient();
  const rows = (await prisma.brokerOrganization.findMany({
    include: { city: { select: { slug: true, name: true } }, _count: { select: { listings: true } } },
    orderBy: { name: "asc" },
  })) as DbOrganizationRow[];
  return rows.filter((row) => isPublicVerification(row.verificationStatus)).map(organizationRowToPublicAgent);
}

export async function getAgentBySlugForServer(slug?: string): Promise<PublicAgentOrganization | undefined> {
  if (!slug) return undefined;
  if (!isPrismaDataSource()) return demoDirectoryAgents().find((agent) => agent.slug === slug);
  const prisma = getPrismaClient();
  const row = (await prisma.brokerOrganization.findFirst({
    where: { slug },
    include: { city: { select: { slug: true, name: true } }, _count: { select: { listings: true } } },
  })) as DbOrganizationRow | null;
  return row && isPublicVerification(row.verificationStatus) ? organizationRowToPublicAgent(row) : undefined;
}

/** Listings attributable to one organization. Fixture listings are attributed
    to the demo organization product-wide (see the lead module), so fixture
    mode returns the first-page slice of the fixture inventory. */
export async function getListingsByAgentForServer(slug: string, limit = 12) {
  if (!isPrismaDataSource()) return getListings().slice(0, limit);
  const prisma = getPrismaClient();
  const rows = await prisma.listing.findMany({
    where: { lifecycle: "ACTIVE", organization: { slug } },
    include: listingInclude,
    orderBy: { meaningfulUpdatedAt: "desc" },
    take: limit,
  });
  return rows.map((row) => dbListingToProperty(row as Parameters<typeof dbListingToProperty>[0]));
}

export async function getListingByIdForServer(id?: string) {
  if (!isPrismaDataSource()) return getListingById(id);
  if (!id) return undefined;
  const prisma = getPrismaClient();
  /* `id` is included so a canonicalToListingId that stores a row id (cuid)
     resolves; stableId and slug keep existing URLs working. No lifecycle
     filter here — the caller decides visibility via httpDecisionForListing,
     which is what makes the DUPLICATE redirect (and the 410s) reachable. */
  const row = await prisma.listing.findFirst({ where: { OR: [{ stableId: id }, { slug: id }, { id }] }, include: listingInclude });
  return row ? dbListingToProperty(row as Parameters<typeof dbListingToProperty>[0]) : undefined;
}

export async function getListingsByLocalityForServer(localitySlug: string, citySlug?: string) {
  if (!isPrismaDataSource()) return getListingsByLocality(localitySlug, citySlug).slice(0, MAX_UNSCOPED_LISTING_ROWS);
  const prisma = getPrismaClient();
  const rows = await prisma.listing.findMany({
    where: { lifecycle: "ACTIVE", locality: { slug: localitySlug, ...(citySlug ? { city: { slug: citySlug } } : {}) } },
    include: listingInclude,
    orderBy: { meaningfulUpdatedAt: "desc" },
    take: MAX_UNSCOPED_LISTING_ROWS,
  });
  return rows.map((row) => dbListingToProperty(row as Parameters<typeof dbListingToProperty>[0]));
}

/** City rows as registry identities. The prisma City carries no editorial
    garnish (tagline/tier/hero live in the reference fixtures), and the SEO
    composer only consumes `slug/name/stateSlug`, so this returns exactly
    that pick rather than fabricating the editorial shape — a page builder
    that needs the full `City` enrichment resolves it by slug from the
    reference registry, the same DB-facts/reference-data split the listing
    mappers use. */
export async function getCitiesForServer(): Promise<Array<Pick<City, "slug" | "name" | "stateSlug">>> {
  if (!isPrismaDataSource()) return getCities();
  const prisma = getPrismaClient();
  const rows = await prisma.city.findMany({ select: { slug: true, name: true, state: true }, orderBy: { name: "asc" } });
  return (rows as Array<Record<string, unknown>>).map((row) => ({
    slug: String(row.slug),
    name: String(row.name),
    stateSlug: String(row.state ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
  }));
}

export async function getLocalitiesForServer() {
  if (!isPrismaDataSource()) return getLocalities();
  const prisma = getPrismaClient();
  const rows = await prisma.locality.findMany({ include: { city: true, postalCodes: { where: { validTo: null }, orderBy: [{ isPrimary: "desc" }, { postalCode: "asc" }] } }, orderBy: [{ city: { name: "asc" } }, { name: "asc" }] });
  return rows.map((row) => dbLocalityToLocality(row as Parameters<typeof dbLocalityToLocality>[0]));
}

export async function getLocalityBySlugForServer(slug?: string, citySlug?: string) {
  if (!isPrismaDataSource()) return getLocalityBySlug(slug, citySlug);
  if (!slug) return undefined;
  const prisma = getPrismaClient();
  const row = await prisma.locality.findFirst({
    where: { slug, ...(citySlug ? { city: { slug: citySlug } } : {}) },
    include: { city: true, postalCodes: { where: { validTo: null }, orderBy: [{ isPrimary: "desc" }, { postalCode: "asc" }] } },
  });
  return row ? dbLocalityToLocality(row as Parameters<typeof dbLocalityToLocality>[0]) : undefined;
}
