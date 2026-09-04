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

  /* Interop contract. These widths and scopes are dictated by pinned upstream
     source, not by taste, so they are asserted rather than left to review.
     See docs/broker-suite/erpnext-consumability-schema-constraints.md. */
  describe("Frappe/ERPNext interop contract", () => {
    const interop = readFileSync("prisma/migrations/202609030003_interop_foundation/migration.sql", "utf8");

    it("declares the outbox and inbound de-duplication models", () => {
      expect(schema).toContain("model InteropOutbox {");
      expect(schema).toContain("model InteropInboundEvent {");
      expect(schema).toContain("enum InteropSyncStatus {");
    });

    it("carries CANCELLED_UPSTREAM, because submittable docs can be cancelled", () => {
      // ERPNext Journal Entry / Sales Invoice are is_submittable; a cancelled
      // doc still exists, so "key found" must not be reported as success.
      expect(schema).toContain("CANCELLED_UPSTREAM");
      expect(schema).toMatch(/remoteDocstatus\s+Int\?/);
    });

    it("bounds the idempotency key below Frappe's varchar(140)", () => {
      expect(schema).toMatch(/idempotencyKey\s+String\s+@unique\s+@db\.VarChar\(128\)/);
      expect(interop).toContain("VARCHAR(128)");
    });

    it("sizes every external Frappe key at varchar(140)", () => {
      for (const field of ["erpnextCustomerId", "frappeCrmOrgId", "frappeCrmLeadId", "remoteDocId"]) {
        expect(schema).toMatch(new RegExp(`${field}\\s+String\\?\\s+@db\\.VarChar\\(140\\)`));
      }
    });

    it("scopes the CRM lead key per organization rather than globally", () => {
      /* Two brokerages run separate Frappe sites whose primary keys collide;
         a global unique index would reject the second one's valid lead. */
      expect(schema).toContain("@@unique([organizationId, frappeCrmLeadId])");
      expect(interop).toContain('ON "Lead" ("organizationId", "frappeCrmLeadId")');
    });

    it("stores the broker business phone in a width that only fits E.164", () => {
      expect(schema).toMatch(/businessPhoneE164\s+String\?\s+@db\.VarChar\(20\)/);
    });

    it("de-duplicates inbound webhooks on (provider, externalId)", () => {
      expect(schema).toContain("@@unique([provider, externalId])");
    });
  });

  /* Tenant isolation is a production gate for the broker channel. Asserted
     here so the migration cannot be quietly weakened; the policies themselves
     are executed against a real PostgreSQL by scripts/security/rls-audit.mjs. */
  describe("row-level security", () => {
    const rls = readFileSync("prisma/migrations/202609030004_row_level_security/migration.sql", "utf8");

    it("protects every tenant-owned table with RLS", () => {
      for (const table of ["Lead", "BrokerUser", "InteropOutbox", "InteropInboundEvent", "AuditEvent"]) {
        expect(rls).toContain(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`);
        // FORCE matters: without it the table owner bypasses every policy, and
        // in small deployments the app role IS the owner.
        expect(rls).toContain(`ALTER TABLE "${table}" FORCE ROW LEVEL SECURITY`);
      }
    });

    it("reads the tenant GUC in a way that denies when unset", () => {
      expect(rls).toContain("current_setting('app.current_org_id', true)");
      expect(rls).toContain("NULLIF");
    });

    it("keeps the audit trail append-only for tenants", () => {
      expect(rls).toMatch(/CREATE POLICY "AuditEvent_tenant_read"[\s\S]*?FOR SELECT/);
      expect(rls).toMatch(/CREATE POLICY "AuditEvent_tenant_append"[\s\S]*?FOR INSERT/);
      expect(rls).not.toMatch(/ON "AuditEvent"[\s\S]*?FOR UPDATE/);
      expect(rls).not.toMatch(/ON "AuditEvent"[\s\S]*?FOR DELETE/);
    });

    it("leaves public property tables unrestricted", () => {
      // Anonymous visitors have no tenant; RLS here would break the public site.
      for (const table of ["City", "Locality", "Listing", "PostalCode"]) {
        expect(rls).not.toContain(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`);
      }
    });
  });

  it("ships PostgreSQL FTS and trigram search indexes", () => {
    expect(searchMigration).toContain("CREATE EXTENSION IF NOT EXISTS pg_trgm");
    expect(searchMigration).toContain('"Listing_searchVector_idx"');
    expect(searchMigration).toContain("gin_trgm_ops");
  });
});
