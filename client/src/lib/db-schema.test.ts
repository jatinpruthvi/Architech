import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const schema = readFileSync("prisma/schema.prisma", "utf8");
const migration = readFileSync("prisma/migrations/202608240001_phase1_domain_schema/migration.sql", "utf8");
const searchMigration = readFileSync("prisma/migrations/202608240002_search_indexes/migration.sql", "utf8");

describe("Phase 1 Prisma schema contract", () => {
  it("declares the required production domain models", () => {
    for (const model of [
      "City",
      "Locality",
      "Listing",
      "PropertyMedia",
      "BrokerOrganization",
      "User",
      "BrokerUser",
      "ReraRecord",
      "Lead",
      "AuditEvent",
      "SavedSearch",
    ]) {
      expect(schema).toContain(`model ${model} {`);
    }
  });

  it("declares lifecycle, verification, localization, and media moderation enums", () => {
    for (const enumName of ["ListingLifecycle", "VerificationStatus", "TranslationStatus", "MediaModerationStatus", "LeadMode", "LeadStatus"]) {
      expect(schema).toContain(`enum ${enumName} {`);
    }
  });

  it("ships an initial migration for the schema", () => {
    expect(migration).toContain('CREATE TABLE "City"');
    expect(migration).toContain('CREATE TABLE "Listing"');
    expect(migration).toContain('CREATE TYPE "ListingLifecycle"');
  });

  it("ships PostgreSQL FTS and trigram search indexes", () => {
    expect(searchMigration).toContain("CREATE EXTENSION IF NOT EXISTS pg_trgm");
    expect(searchMigration).toContain('"Listing_searchVector_idx"');
    expect(searchMigration).toContain("gin_trgm_ops");
  });
});
