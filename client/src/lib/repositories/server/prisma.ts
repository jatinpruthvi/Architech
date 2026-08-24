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

export async function getListingsForServer() {
  if (!isPrismaDataSource()) return getListings();
  const prisma = getPrismaClient();
  const rows = await prisma.listing.findMany({
    where: { lifecycle: "ACTIVE" },
    include: listingInclude,
    orderBy: { meaningfulUpdatedAt: "desc" },
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
