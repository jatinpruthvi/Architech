import { isPrismaDataSource } from "@/lib/repositories/source";

export type SearchSourceMode = "fixture" | "prisma";

export function getSearchSourceMode(value = process.env.ARCHITECH_SEARCH_SOURCE): SearchSourceMode {
  if (value === "prisma") return "prisma";
  if (value === "fixture") return "fixture";
  return isPrismaDataSource() ? "prisma" : "fixture";
}

export function isPrismaSearchSource(value = process.env.ARCHITECH_SEARCH_SOURCE) {
  return getSearchSourceMode(value) === "prisma";
}
