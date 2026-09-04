import "server-only";
import { createRequire } from "node:module";
import { dbListingToProperty, dbLocalityToLocality } from "@/lib/repositories/mappers";
import { getListings, getListingById, getListingsByLocality, getLocalities, getLocalityBySlug } from "@/lib/repositories";
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
 * Read the active inventory for a scope.
 *
 * Before the facet rebuild this issued `findMany({ where: { lifecycle } })`
 * with no scope and no bound, and every caller then filtered the result in JS —
 * i.e. one unbounded table read per search, growing with the feed. The city is
 * now pushed into the query and an explicit ceiling caps the nationwide case.
 */
export async function getListingsForServer(scope: ListingScope = {}) {
  /* Every read — city-scoped or not — gets the same ceiling and the same
     stable ordering. Before this, a city-scoped read omitted `take` entirely
     and could pull an entire city table into memory while the nationwide read
     was capped; two paths that disagree on their own limits is how a capped
     result silently becomes an unbounded one. */
  const ceiling = scope.limit ?? MAX_UNSCOPED_LISTING_ROWS;
  if (!isPrismaDataSource()) {
    const all = getListings();
    const cityScoped = scope.citySlug ? all.filter((listing) => listing.citySlug === scope.citySlug) : all;
    return cityScoped.slice(0, ceiling);
  }
  const prisma = getPrismaClient();
  const rows = await prisma.listing.findMany({
    where: {
      lifecycle: "ACTIVE",
      ...(scope.citySlug ? { city: { slug: scope.citySlug } } : {}),
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
