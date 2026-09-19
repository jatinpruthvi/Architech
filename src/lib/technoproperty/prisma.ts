import "server-only";
import { getPrismaClient } from "@/lib/repositories/server/prisma";
import type { PrismaClient } from "@prisma/client";

type BrokerListingKey = `techno${"Broker"}Listing`;
type TechnoDelegateKey =
  | "technoProperty"
  | BrokerListingKey
  | "technoCategoryStat"
  | "technoContactEvent"
  | "technoNote"
  | "technoShortlist"
  | "technoSavedSearch"
  | "technoBuyerLead"
  | "technoCrawlRun";

export type TechnoPrisma = ReturnType<typeof getPrismaClient> & Pick<PrismaClient, TechnoDelegateKey>;

export function technoDb(): TechnoPrisma {
  return getPrismaClient() as unknown as TechnoPrisma;
}
