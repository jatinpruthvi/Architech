import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "db/schema.prisma",
  migrations: {
    path: "db/migrations",
    seed: "node db/seed.mjs",
  },
  datasource: {
    url: process.env.DATABASE_URL ?? "postgresql://architech:architech@localhost:5432/architech?schema=public",
  },
});
