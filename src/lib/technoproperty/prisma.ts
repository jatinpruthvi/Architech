import "server-only";
import { getPrismaClient } from "@/lib/repositories/server/prisma";
import type { Prisma } from "@prisma/client";

export type TechnoPrisma = ReturnType<typeof getPrismaClient> & {
  technoProperty: Prisma.TechnoPropertyDelegate;
  technoBrokerListing: Prisma.TechnoBrokerListingDelegate;
  technoCategoryStat: Prisma.TechnoCategoryStatDelegate;
  technoContactEvent: Prisma.TechnoContactEventDelegate;
  technoNote: Prisma.TechnoNoteDelegate;
  technoShortlist: Prisma.TechnoShortlistDelegate;
  technoSavedSearch: Prisma.TechnoSavedSearchDelegate;
  technoCrawlRun: Prisma.TechnoCrawlRunDelegate;
};

export function technoDb(): TechnoPrisma {
  return getPrismaClient() as unknown as TechnoPrisma;
}
