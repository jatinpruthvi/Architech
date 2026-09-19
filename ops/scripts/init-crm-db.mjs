#!/usr/bin/env node
/**
 * Frappe CRM Database Migration & Synchronization for Architech.
 *
 * Creates the Frappe CRM schema tables in the PostgreSQL database:
 *   - tabCRM Property
 *   - tabCRM Requirement
 *   - tabCRM Contact Reveal Log
 *   - tabCRM Lead
 *   - tabCRM Deal
 *   - tabCRM Call Log
 *   - tabCRM Task
 *   - tabFCRM Note
 *
 * Then populates/syncs seed records from TechnoProperty and Requirement so the
 * CRM is fully populated and functional out-of-the-box.
 */
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..", "..");
dotenv.config({ path: path.join(repoRoot, ".env") });

const require = createRequire(import.meta.url);
const { Client } = require("pg");

const DATABASE_URL = process.env.DATABASE_URL || "postgresql://architech:architech@localhost:5432/architech?schema=public";

async function run() {
  console.log("[init-crm-db] Connecting to PostgreSQL at", DATABASE_URL.replace(/:[^:@]+@/, ":***@"));
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();

  try {
    console.log("[init-crm-db] Creating Frappe CRM database tables...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS "tabCRM Property" (
        "name" VARCHAR(140) PRIMARY KEY,
        "creation" TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        "modified" TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        "modified_by" VARCHAR(140) DEFAULT 'Administrator',
        "owner" VARCHAR(140) DEFAULT 'Administrator',
        "docstatus" INT DEFAULT 0,
        "idx" INT DEFAULT 0,
        "naming_series" VARCHAR(140) DEFAULT 'CRM-PROP-.YYYY.-',
        "property_name" VARCHAR(255) NOT NULL,
        "category" VARCHAR(140) NOT NULL,
        "listing_type" VARCHAR(140) DEFAULT 'Owner',
        "property_type" VARCHAR(140) DEFAULT 'Apartment',
        "bhk" VARCHAR(50) DEFAULT '2 BHK',
        "status" VARCHAR(140) DEFAULT 'Available',
        "is_premium" INT DEFAULT 0,
        "shortlisted" INT DEFAULT 0,
        "image" TEXT,
        "price" NUMERIC(18, 2) NOT NULL DEFAULT 0,
        "maintenance_charges" NUMERIC(18, 2) DEFAULT 0,
        "deposit_amount" NUMERIC(18, 2) DEFAULT 0,
        "super_builtup_area" DOUBLE PRECISION DEFAULT 0,
        "carpet_area" DOUBLE PRECISION DEFAULT 0,
        "furnishing" VARCHAR(140) DEFAULT 'Unfurnished',
        "availability" VARCHAR(140) DEFAULT 'Immediate',
        "premise_name" VARCHAR(255),
        "address" TEXT,
        "area" VARCHAR(255) NOT NULL,
        "city" VARCHAR(140) DEFAULT 'Ahmedabad',
        "pincode" VARCHAR(20),
        "latitude" DOUBLE PRECISION,
        "longitude" DOUBLE PRECISION,
        "owner_name" VARCHAR(255),
        "owner_phone" VARCHAR(50),
        "owner_phone_last4" VARCHAR(10),
        "owner_email" VARCHAR(255),
        "contact_revealed" INT DEFAULT 0,
        "reveal_count" INT DEFAULT 0,
        "current_outcome" VARCHAR(140),
        "last_call_at" TIMESTAMP WITHOUT TIME ZONE,
        "follow_up_at" TIMESTAMP WITHOUT TIME ZONE,
        "total_calls" INT DEFAULT 0,
        "latest_note" TEXT,
        "description" TEXT,
        "amenities" TEXT
      );

      CREATE TABLE IF NOT EXISTS "tabCRM Requirement" (
        "name" VARCHAR(140) PRIMARY KEY,
        "creation" TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        "modified" TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        "modified_by" VARCHAR(140) DEFAULT 'Administrator',
        "owner" VARCHAR(140) DEFAULT 'Administrator',
        "docstatus" INT DEFAULT 0,
        "idx" INT DEFAULT 0,
        "naming_series" VARCHAR(140) DEFAULT 'CRM-REQ-.YYYY.-',
        "title" VARCHAR(255) NOT NULL,
        "client_name" VARCHAR(255) NOT NULL,
        "client_phone" VARCHAR(50) NOT NULL,
        "client_email" VARCHAR(255),
        "lead" VARCHAR(140),
        "contact" VARCHAR(140),
        "deal_type" VARCHAR(140) DEFAULT 'Rent',
        "category" VARCHAR(140) NOT NULL,
        "status" VARCHAR(140) DEFAULT 'Active',
        "priority" VARCHAR(140) DEFAULT 'Medium',
        "bhk" VARCHAR(50) DEFAULT '2 BHK',
        "property_type" VARCHAR(140) DEFAULT 'Any',
        "furnishing" VARCHAR(140) DEFAULT 'Any',
        "budget_min" NUMERIC(18, 2) DEFAULT 0,
        "budget_max" NUMERIC(18, 2) DEFAULT 0,
        "preferred_locality" VARCHAR(255) NOT NULL,
        "target_city" VARCHAR(140) DEFAULT 'Ahmedabad',
        "timeline" VARCHAR(140) DEFAULT 'Immediate',
        "matched_count" INT DEFAULT 0,
        "notes" TEXT
      );

      CREATE TABLE IF NOT EXISTS "tabCRM Contact Reveal Log" (
        "name" SERIAL PRIMARY KEY,
        "creation" TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        "modified" TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        "modified_by" VARCHAR(140) DEFAULT 'Administrator',
        "owner" VARCHAR(140) DEFAULT 'Administrator',
        "docstatus" INT DEFAULT 0,
        "idx" INT DEFAULT 0,
        "property" VARCHAR(140) NOT NULL,
        "user" VARCHAR(140) NOT NULL,
        "revealed_at" TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "channel" VARCHAR(140) DEFAULT 'Desktop',
        "owner_phone_revealed" VARCHAR(50),
        "ip_address" VARCHAR(100),
        "user_agent" TEXT
      );

      CREATE TABLE IF NOT EXISTS "tabCRM Lead" (
        "name" VARCHAR(140) PRIMARY KEY,
        "creation" TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        "modified" TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        "modified_by" VARCHAR(140) DEFAULT 'Administrator',
        "owner" VARCHAR(140) DEFAULT 'Administrator',
        "docstatus" INT DEFAULT 0,
        "idx" INT DEFAULT 0,
        "lead_name" VARCHAR(255),
        "email" VARCHAR(255),
        "mobile_no" VARCHAR(50),
        "status" VARCHAR(140) DEFAULT 'Lead',
        "source" VARCHAR(140),
        "territory" VARCHAR(140)
      );

      CREATE TABLE IF NOT EXISTS "tabCRM Call Log" (
        "name" VARCHAR(140) PRIMARY KEY,
        "creation" TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        "modified" TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        "modified_by" VARCHAR(140) DEFAULT 'Administrator',
        "owner" VARCHAR(140) DEFAULT 'Administrator',
        "docstatus" INT DEFAULT 0,
        "idx" INT DEFAULT 0,
        "to" VARCHAR(50),
        "type" VARCHAR(140) DEFAULT 'Outgoing',
        "status" VARCHAR(140),
        "duration" INT DEFAULT 0,
        "summary" TEXT,
        "reference_doctype" VARCHAR(140),
        "reference_docname" VARCHAR(140)
      );

      CREATE TABLE IF NOT EXISTS "tabCRM Task" (
        "name" VARCHAR(140) PRIMARY KEY,
        "creation" TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        "modified" TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        "modified_by" VARCHAR(140) DEFAULT 'Administrator',
        "owner" VARCHAR(140) DEFAULT 'Administrator',
        "docstatus" INT DEFAULT 0,
        "idx" INT DEFAULT 0,
        "title" VARCHAR(255),
        "status" VARCHAR(140) DEFAULT 'Open',
        "priority" VARCHAR(140) DEFAULT 'High',
        "due_date" TIMESTAMP WITHOUT TIME ZONE,
        "description" TEXT,
        "reference_doctype" VARCHAR(140),
        "reference_docname" VARCHAR(140)
      );

      CREATE TABLE IF NOT EXISTS "tabFCRM Note" (
        "name" VARCHAR(140) PRIMARY KEY,
        "creation" TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        "modified" TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        "modified_by" VARCHAR(140) DEFAULT 'Administrator',
        "owner" VARCHAR(140) DEFAULT 'Administrator',
        "docstatus" INT DEFAULT 0,
        "idx" INT DEFAULT 0,
        "title" VARCHAR(255),
        "content" TEXT,
        "reference_doctype" VARCHAR(140),
        "reference_docname" VARCHAR(140)
      );

      CREATE TABLE IF NOT EXISTS "tabCRM Deal" (
        "name" VARCHAR(140) PRIMARY KEY,
        "creation" TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        "modified" TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        "modified_by" VARCHAR(140) DEFAULT 'Administrator',
        "owner" VARCHAR(140) DEFAULT 'Administrator',
        "docstatus" INT DEFAULT 0,
        "idx" INT DEFAULT 0,
        "deal_name" VARCHAR(255),
        "status" VARCHAR(140) DEFAULT 'Open',
        "deal_value" NUMERIC(18, 2) DEFAULT 0,
        "expected_close_date" DATE,
        "reference_doctype" VARCHAR(140),
        "reference_docname" VARCHAR(140)
      );

      CREATE INDEX IF NOT EXISTS "tabCRM_Property_category_idx" ON "tabCRM Property" ("category");
      CREATE INDEX IF NOT EXISTS "tabCRM_Property_status_idx" ON "tabCRM Property" ("status");
      CREATE INDEX IF NOT EXISTS "tabCRM_Property_area_idx" ON "tabCRM Property" ("area");
      CREATE INDEX IF NOT EXISTS "tabCRM_Property_price_idx" ON "tabCRM Property" ("price");
      CREATE INDEX IF NOT EXISTS "tabCRM_Requirement_status_idx" ON "tabCRM Requirement" ("status");
      CREATE INDEX IF NOT EXISTS "tabCRM_Requirement_pref_loc_idx" ON "tabCRM Requirement" ("preferred_locality");
    `);

    console.log("[init-crm-db] Schema created. Synchronizing properties from TechnoProperty...");
    const syncRes = await client.query(`
      INSERT INTO "tabCRM Property" (
        "name", "creation", "modified", "property_name", "category",
        "listing_type", "property_type", "bhk", "status", "is_premium",
        "shortlisted", "price", "super_builtup_area", "carpet_area",
        "furnishing", "availability", "premise_name", "address", "area",
        "city", "owner_name", "owner_phone", "owner_phone_last4",
        "contact_revealed", "current_outcome", "total_calls", "description"
      )
      SELECT
        'CRM-PROP-' || "externalId",
        "firstSeenAt",
        "lastModifiedAt",
        COALESCE("premiseName" || ' - ' || "keyInfo", "propertyType" || ' in ' || "area"),
        CASE "category"
          WHEN 'RESIDENTIAL_RENT' THEN 'Residential Rent'
          WHEN 'RESIDENTIAL_SELL' THEN 'Residential Sell'
          WHEN 'COMMERCIAL_RENT' THEN 'Commercial Rent'
          WHEN 'COMMERCIAL_SELL' THEN 'Commercial Sell'
          ELSE 'Residential Rent'
        END,
        'Owner',
        "propertyType",
        COALESCE("keyInfo", '2 BHK'),
        CASE "sourceStatus"::text
          WHEN 'ACTIVE' THEN 'Available'
          WHEN 'RENTED_OUT' THEN 'Rented Out'
          WHEN 'SOLD' THEN 'Sold Out'
          WHEN 'REMOVED' THEN 'Archived'
          ELSE 'Available'
        END,
        CASE WHEN "isPremium" THEN 1 ELSE 0 END,
        CASE WHEN "sourceShortlisted" THEN 1 ELSE 0 END,
        COALESCE("rentPriceValue", 0)::numeric,
        COALESCE("sqftValue", 1000)::double precision,
        COALESCE("sqftValue" * 0.8, 800)::double precision,
        COALESCE("furnitureRaw", 'Unfurnished'),
        COALESCE("availabilityRaw", 'Immediate'),
        "premiseName",
        "address",
        COALESCE("area", 'Bodakdev'),
        'Ahmedabad',
        COALESCE("ownerName", 'Owner'),
        '+9198250' || COALESCE("ownerPhoneLast4", '5432'),
        COALESCE("ownerPhoneLast4", '5432'),
        0,
        'Connected',
        0,
        "descriptionRaw"
      FROM "TechnoProperty"
      ON CONFLICT ("name") DO NOTHING;
    `);

    console.log(`[init-crm-db] Synchronized ${syncRes.rowCount || 0} properties into tabCRM Property.`);

    console.log("[init-crm-db] Seeding demo buyer requirements into tabCRM Requirement...");
    await client.query(`
      INSERT INTO "tabCRM Requirement" (
        "name", "creation", "title", "client_name", "client_phone", "deal_type", "category",
        "status", "priority", "bhk", "property_type", "furnishing", "budget_min", "budget_max",
        "preferred_locality", "target_city", "timeline", "notes"
      ) VALUES
        ('CRM-REQ-2026-001', NOW(), 'Looking for 3 BHK in Bodakdev', 'Amitabh Shah', '+919825011223', 'Buy', 'Residential Sell', 'Active', 'High', '3 BHK', 'Apartment', 'Furnished', 12000000, 16000000, 'Bodakdev', 'Ahmedabad', 'Within 15 Days', 'Prefers higher floor with garden facing view'),
        ('CRM-REQ-2026-002', NOW(), '2 BHK Rental near SG Highway', 'Pooja Patel', '+919825022334', 'Rent', 'Residential Rent', 'Active', 'Urgent', '2 BHK', 'Apartment', 'Semi-Furnished', 25000, 35000, 'SG Highway', 'Ahmedabad', 'Immediate', 'IT professional, immediate move-in requirement'),
        ('CRM-REQ-2026-003', NOW(), 'Commercial Showroom on Prahlad Nagar Road', 'Nirav Modi', '+919825033445', 'Rent', 'Commercial Rent', 'Active', 'Medium', 'Any', 'Showroom', 'Unfurnished', 75000, 120000, 'Prahlad Nagar', 'Ahmedabad', 'Within 1 Month', 'Retail brand opening branch, ground floor mandatory'),
        ('CRM-REQ-2026-004', NOW(), '4 BHK Penthouse / Villa in Thaltej', 'Sanjay Dave', '+919825044556', 'Buy', 'Residential Sell', 'Active', 'High', '4 BHK', 'Penthouse', 'Any', 25000000, 40000000, 'Thaltej', 'Ahmedabad', 'Within 3 Months', 'HNI family, gated community with clubhouse required')
      ON CONFLICT ("name") DO NOTHING;
    `);

    console.log("[init-crm-db] Seeding demo CRM leads and call logs...");
    await client.query(`
      INSERT INTO "tabCRM Lead" ("name", "creation", "lead_name", "email", "mobile_no", "status", "source", "territory")
      VALUES
        ('LEAD-2026-001', NOW(), 'Amitabh Shah', 'amitabh.shah@example.com', '+919825011223', 'Interested', 'Website', 'Ahmedabad'),
        ('LEAD-2026-002', NOW(), 'Pooja Patel', 'pooja.patel@example.com', '+919825022334', 'Qualified', 'Referral', 'Ahmedabad'),
        ('LEAD-2026-003', NOW(), 'Nirav Modi', 'nirav.m@example.com', '+919825033445', 'Meeting Scheduled', 'Cold Call', 'Ahmedabad')
      ON CONFLICT ("name") DO NOTHING;
    `);

    const countProp = await client.query('SELECT count(*)::int as c FROM "tabCRM Property"');
    const countReq = await client.query('SELECT count(*)::int as c FROM "tabCRM Requirement"');
    const countLead = await client.query('SELECT count(*)::int as c FROM "tabCRM Lead"');

    console.log(`[init-crm-db] Verification: ${countProp.rows[0].c} properties, ${countReq.rows[0].c} requirements, ${countLead.rows[0].c} leads live in database.`);
    console.log("[init-crm-db] Done.");
  } finally {
    await client.end();
  }
}

run().catch((err) => {
  console.error("[init-crm-db] Error:", err);
  process.exit(1);
});
