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

  /* Money width is a correctness constraint, not a style preference: an Int32
     column caps at ~Rs 214 crore, and the broker channel's BigInt price/budget
     columns are populated from this one. Asserted here so a future schema edit
     cannot quietly narrow it back. */
  it("stores listing price as BigInt so large transactions cannot overflow", () => {
    expect(schema).toMatch(/priceInr\s+BigInt/);
    expect(schema).not.toMatch(/priceInr\s+Int\b/);
  });

  it("ships the widening migration for the listing price column", () => {
    const widening = readFileSync("prisma/migrations/202609030002_listing_price_bigint/migration.sql", "utf8");
    expect(widening).toContain('ALTER TABLE "Listing"');
    expect(widening).toContain("BIGINT");
  });

  it("ships PostgreSQL FTS and trigram search indexes", () => {
    expect(searchMigration).toContain("CREATE EXTENSION IF NOT EXISTS pg_trgm");
    expect(searchMigration).toContain('"Listing_searchVector_idx"');
    expect(searchMigration).toContain("gin_trgm_ops");
  });
});
