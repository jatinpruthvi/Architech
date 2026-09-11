import { isPrismaDataSource } from "@/lib/repositories/source";

export type AuthorityStorageMode = "memory" | "prisma";

export function getAuthorityStorageMode(value = process.env.ARCHITECH_AUTHORITY_STORAGE): AuthorityStorageMode {
  if (value === "prisma") return "prisma";
  if (value === "memory") return "memory";
  return isPrismaDataSource() ? "prisma" : "memory";
}

export function isPrismaAuthorityStorage(value = process.env.ARCHITECH_AUTHORITY_STORAGE) {
  return getAuthorityStorageMode(value) === "prisma";
}
