import { isPrismaDataSource } from "@/lib/repositories/source";

export type SavedSearchStorageMode = "memory" | "prisma";

export function getSavedSearchStorageMode(value = process.env.ARCHITECH_SAVED_SEARCH_STORAGE): SavedSearchStorageMode {
  if (value === "prisma") return "prisma";
  if (value === "memory") return "memory";
  return isPrismaDataSource() ? "prisma" : "memory";
}

export function isPrismaSavedSearchStorage(value = process.env.ARCHITECH_SAVED_SEARCH_STORAGE) {
  return getSavedSearchStorageMode(value) === "prisma";
}

export function validateSavedSearchStorageEnvironment(value = process.env.ARCHITECH_SAVED_SEARCH_STORAGE) {
  const missing: string[] = [];
  if (getSavedSearchStorageMode(value) === "prisma" && !process.env.DATABASE_URL) missing.push("DATABASE_URL");
  return { ok: missing.length === 0, missing };
}
