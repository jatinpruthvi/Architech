/* Persistence source switch for server-only write-through stores.

   The broker/media/RERA modules are in-memory contract stores used by the
   prototype. In production with `ARCHITECH_DATA_SOURCE=prisma` the same
   operations are persisted to PostgreSQL (and read back from it) via
   server-only adapters. This module centralizes mode resolution so the
   adapters and tests share one decision. */
import { isPrismaDataSource } from "@/lib/repositories/source";

export type PersistenceMode = "fixture" | "prisma";

export function getPersistenceMode(value = process.env.ARCHITECH_DATA_SOURCE): PersistenceMode {
  return isPrismaDataSource(value) ? "prisma" : "fixture";
}

export function isPrismaPersistence(value = process.env.ARCHITECH_DATA_SOURCE): boolean {
  return getPersistenceMode(value) === "prisma";
}
