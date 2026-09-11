import { isPrismaDataSource } from "@/lib/repositories/source";

export type LeadStorageMode = "memory" | "prisma";

export function getLeadStorageMode(value = process.env.ARCHITECH_LEAD_STORAGE): LeadStorageMode {
  if (value === "prisma") return "prisma";
  if (value === "memory") return "memory";
  return isPrismaDataSource() ? "prisma" : "memory";
}

export function isPrismaLeadStorage(value = process.env.ARCHITECH_LEAD_STORAGE) {
  return getLeadStorageMode(value) === "prisma";
}
