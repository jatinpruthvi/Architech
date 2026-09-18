import assert from "node:assert/strict";
import test from "node:test";
import { schemaEngineEnvironment } from "./schema-engine-env.mjs";

test("Prisma uses the installed package engine when the caller has no override", () => {
  const env = schemaEngineEnvironment(
    { HOME: "/home/test", DATABASE_URL: "postgresql://sandbox" },
    "/repo/node_modules/@prisma/engines/schema-engine-linux",
  );

  assert.equal(
    env.PRISMA_SCHEMA_ENGINE_BINARY,
    "/repo/node_modules/@prisma/engines/schema-engine-linux",
  );
  assert.equal(
    env.PRISMA_MIGRATION_ENGINE_BINARY,
    "/repo/node_modules/@prisma/engines/schema-engine-linux",
  );
});

test("an explicit caller engine override wins over the installed fallback", () => {
  const env = schemaEngineEnvironment(
    { PRISMA_SCHEMA_ENGINE_BINARY: "/custom/schema-engine" },
    "/repo/node_modules/@prisma/engines/schema-engine-linux",
  );

  assert.equal(env.PRISMA_SCHEMA_ENGINE_BINARY, "/custom/schema-engine");
  assert.equal(env.PRISMA_MIGRATION_ENGINE_BINARY, "/custom/schema-engine");
});
