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

function loadPrismaClientConstructor(): new () => PrismaClientLike {
  const require = createRequire(import.meta.url);
  const clientModule = require("@prisma/client") as { PrismaClient?: new () => PrismaClientLike };
  if (!clientModule.PrismaClient) {
    throw new Error("PrismaClient is not generated. Run `pnpm db:generate` before using ARCHITECH_DATA_SOURCE=prisma.");
  }
  return clientModule.PrismaClient;
}

export function getPrismaClient() {
  if (!globalThis.__architechPrisma) {
    const PrismaClient = loadPrismaClientConstructor();
    globalThis.__architechPrisma = new PrismaClient();
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
  if (!isPrismaDataSource()) {
    const all = getListings();
    const cityScoped = scope.citySlug ? all.filter((listing) => listing.citySlug === scope.citySlug) : all;
    const ceiling = scope.limit ?? (scope.citySlug ? undefined : MAX_UNSCOPED_LISTING_ROWS);
    return ceiling ? cityScoped.slice(0, ceiling) : cityScoped;
  }
  const prisma = getPrismaClient();
  const rows = await prisma.listing.findMany({
    where: {
      lifecycle: "ACTIVE",
      ...(scope.citySlug ? { city: { slug: scope.citySlug } } : {}),
    },
    include: listingInclude,
    orderBy: { meaningfulUpdatedAt: "desc" },
    ...(scope.limit ?? (!scope.citySlug ? MAX_UNSCOPED_LISTING_ROWS : undefined)
      ? { take: scope.limit ?? MAX_UNSCOPED_LISTING_ROWS }
      : {}),
  });
  return rows.map((row) => dbListingToProperty(row as Parameters<typeof dbListingToProperty>[0]));
}

export async function getListingByIdForServer(id?: string) {
  if (!isPrismaDataSource()) return getListingById(id);
  if (!id) return undefined;
  const prisma = getPrismaClient();
  const row = await prisma.listing.findFirst({ where: { OR: [{ stableId: id }, { slug: id }], lifecycle: "ACTIVE" }, include: listingInclude });
  return row ? dbListingToProperty(row as Parameters<typeof dbListingToProperty>[0]) : undefined;
}

export async function getListingsByLocalityForServer(localitySlug: string) {
  if (!isPrismaDataSource()) return getListingsByLocality(localitySlug);
  const prisma = getPrismaClient();
  const rows = await prisma.listing.findMany({ where: { lifecycle: "ACTIVE", locality: { slug: localitySlug } }, include: listingInclude, orderBy: { meaningfulUpdatedAt: "desc" } });
  return rows.map((row) => dbListingToProperty(row as Parameters<typeof dbListingToProperty>[0]));
}

export async function getLocalitiesForServer() {
  if (!isPrismaDataSource()) return getLocalities();
  const prisma = getPrismaClient();
  const rows = await prisma.locality.findMany({ include: { city: true }, orderBy: { name: "asc" } });
  return rows.map((row) => dbLocalityToLocality(row as Parameters<typeof dbLocalityToLocality>[0]));
}

export async function getLocalityBySlugForServer(slug?: string) {
  if (!isPrismaDataSource()) return getLocalityBySlug(slug);
  if (!slug) return undefined;
  const prisma = getPrismaClient();
  const row = await prisma.locality.findFirst({ where: { slug } });
  return row ? dbLocalityToLocality(row as Parameters<typeof dbLocalityToLocality>[0]) : undefined;
}
