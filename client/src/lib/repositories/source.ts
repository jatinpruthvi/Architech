export type DataSourceMode = "fixture" | "prisma";

export function getDataSourceMode(value = process.env.ARCHITECH_DATA_SOURCE): DataSourceMode {
  return value === "prisma" ? "prisma" : "fixture";
}

export function isPrismaDataSource(value = process.env.ARCHITECH_DATA_SOURCE) {
  return getDataSourceMode(value) === "prisma";
}
