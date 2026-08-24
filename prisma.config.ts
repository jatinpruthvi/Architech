import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "node prisma/seed.mjs",
  },
  datasource: {
    url: process.env.DATABASE_URL ?? "postgresql://architech:architech@localhost:5432/architech?schema=public",
  },
});
