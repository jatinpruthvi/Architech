-- India-wide location foundation.
--
-- PIN, post office, product locality, administrative boundary and coordinate
-- are separate identities. This migration keeps the legacy array columns for a
-- staged rollout, backfills normalized rows, and adds provenance on every
-- imported fact. PostGIS must be enabled by the database owner before deploy
-- where the application role cannot create extensions.

CREATE EXTENSION IF NOT EXISTS "postgis";

-- The launch schema silently assigned Gujarat to any RERA row whose caller
-- omitted jurisdiction. National records must always supply the authority's
-- state/UT explicitly.
ALTER TABLE "ReraRecord" ALTER COLUMN "state" DROP DEFAULT;
ALTER TABLE "ReraRecord" ADD COLUMN "jurisdictionSlug" TEXT;
UPDATE "ReraRecord"
SET "jurisdictionSlug" = trim(BOTH '-' FROM regexp_replace(lower(trim("state")), '[^a-z0-9]+', '-', 'g'))
WHERE "jurisdictionSlug" IS NULL;
ALTER TABLE "ReraRecord" ALTER COLUMN "jurisdictionSlug" SET NOT NULL;
DROP INDEX IF EXISTS "ReraRecord_registrationNumber_key";
CREATE UNIQUE INDEX "ReraRecord_jurisdictionSlug_registrationNumber_key"
  ON "ReraRecord"("jurisdictionSlug", "registrationNumber");
CREATE INDEX "ReraRecord_jurisdictionSlug_verificationStatus_idx"
  ON "ReraRecord"("jurisdictionSlug", "verificationStatus");

CREATE TYPE "LocationSourceStatus" AS ENUM ('STAGING', 'ACTIVE', 'SUPERSEDED', 'WITHDRAWN');
CREATE TYPE "AdministrativeAreaType" AS ENUM ('COUNTRY', 'STATE_OR_UT', 'DIVISION', 'DISTRICT', 'SUBDISTRICT', 'LOCAL_BODY', 'WARD', 'VILLAGE', 'OTHER');
CREATE TYPE "LocalityKind" AS ENUM ('NEIGHBOURHOOD', 'SUBLOCALITY', 'SECTOR', 'LAYOUT', 'VILLAGE', 'BUSINESS_DISTRICT', 'CORRIDOR', 'OTHER');
CREATE TYPE "LocalityAliasType" AS ENUM ('OFFICIAL', 'COMMON', 'HISTORIC', 'TRANSLITERATION', 'MISSPELLING', 'SEARCH');
CREATE TYPE "AdministrativeAreaRole" AS ENUM ('CONTAINS', 'STATE', 'DISTRICT', 'LOCAL_BODY', 'WARD');
CREATE TYPE "PostalLinkType" AS ENUM ('PRIMARY', 'SERVED_BY', 'INTERSECTS', 'MANUAL');
CREATE TYPE "GeocodePrecision" AS ENUM ('EXACT', 'BUILDING', 'STREET', 'POST_OFFICE', 'POSTAL_AREA', 'LOCALITY', 'CITY', 'UNKNOWN');
CREATE TYPE "CoordinateVisibility" AS ENUM ('PRIVATE_EXACT', 'STREET_APPROXIMATE', 'LOCALITY_APPROXIMATE', 'HIDDEN');
CREATE TYPE "LocationImportStatus" AS ENUM ('RUNNING', 'SUCCEEDED', 'SUCCEEDED_WITH_REJECTIONS', 'FAILED', 'CANCELLED');
CREATE TYPE "LocationImportMode" AS ENUM ('DRY_RUN', 'APPLY');

CREATE TABLE "LocationSource" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "publisher" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "downloadUrl" TEXT,
    "licenseName" TEXT,
    "licenseUrl" TEXT,
    "attribution" TEXT,
    "version" TEXT,
    "checksumSha256" TEXT,
    "publishedAt" TIMESTAMP(3),
    "retrievedAt" TIMESTAMP(3) NOT NULL,
    "status" "LocationSourceStatus" NOT NULL DEFAULT 'ACTIVE',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LocationSource_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "LocationSource_key_key" ON "LocationSource"("key");

CREATE TABLE "AdministrativeArea" (
    "id" TEXT NOT NULL,
    "type" "AdministrativeAreaType" NOT NULL,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "nativeName" TEXT,
    "slug" TEXT,
    "subtype" TEXT,
    "metadata" JSONB,
    "parentId" TEXT,
    "sourceId" TEXT,
    "sourceFeatureId" TEXT,
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "centroid" geography(Point,4326),
    "boundary" geometry(MultiPolygon,4326),
    "validFrom" TIMESTAMP(3),
    "validTo" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AdministrativeArea_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CityAdministrativeArea" (
    "cityId" TEXT NOT NULL,
    "administrativeAreaId" TEXT NOT NULL,
    "role" "AdministrativeAreaRole" NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "sourceId" TEXT,
    CONSTRAINT "CityAdministrativeArea_pkey" PRIMARY KEY ("cityId", "administrativeAreaId", "role")
);

CREATE TABLE "LocalityAdministrativeArea" (
    "localityId" TEXT NOT NULL,
    "administrativeAreaId" TEXT NOT NULL,
    "role" "AdministrativeAreaRole" NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "sourceId" TEXT,
    CONSTRAINT "LocalityAdministrativeArea_pkey" PRIMARY KEY ("localityId", "administrativeAreaId", "role")
);

CREATE TABLE "LocalityAlias" (
    "id" TEXT NOT NULL,
    "localityId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "languageCode" VARCHAR(16) NOT NULL DEFAULT 'und',
    "scriptCode" VARCHAR(8),
    "type" "LocalityAliasType" NOT NULL DEFAULT 'COMMON',
    "isPreferred" BOOLEAN NOT NULL DEFAULT false,
    "sourceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LocalityAlias_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "LocalityAlias_localityId_normalizedName_languageCode_key" ON "LocalityAlias"("localityId", "normalizedName", "languageCode");

CREATE TABLE "PostalCode" (
    "code" VARCHAR(6) NOT NULL,
    "sourceId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "validFrom" TIMESTAMP(3),
    "validTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PostalCode_pkey" PRIMARY KEY ("code"),
    CONSTRAINT "PostalCode_code_format" CHECK ("code" ~ '^[1-9][0-9]{5}$')
);

CREATE TABLE "PostOffice" (
    "id" TEXT NOT NULL,
    "postalCode" VARCHAR(6) NOT NULL,
    "name" TEXT NOT NULL,
    "officeType" TEXT,
    "deliveryStatus" TEXT,
    "circleName" TEXT,
    "regionName" TEXT,
    "divisionName" TEXT,
    "districtName" TEXT,
    "stateName" TEXT,
    "administrativeAreaId" TEXT,
    "localityId" TEXT,
    "sourceId" TEXT NOT NULL,
    "sourceRecordId" TEXT NOT NULL,
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "coordinatePrecision" "GeocodePrecision" NOT NULL DEFAULT 'UNKNOWN',
    "digipin" VARCHAR(10),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "validFrom" TIMESTAMP(3),
    "validTo" TIMESTAMP(3),
    "raw" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PostOffice_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PostOffice_coordinate_pair" CHECK (("latitude" IS NULL) = ("longitude" IS NULL)),
    CONSTRAINT "PostOffice_digipin_format" CHECK ("digipin" IS NULL OR "digipin" ~ '^[23456789CJKLMPFT]{10}$')
);

CREATE TABLE "LocalityPostalCode" (
    "localityId" TEXT NOT NULL,
    "postalCode" VARCHAR(6) NOT NULL,
    "linkType" "PostalLinkType" NOT NULL DEFAULT 'SERVED_BY',
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "confidence" DECIMAL(4,3),
    "sourceId" TEXT,
    "evidence" JSONB,
    "validFrom" TIMESTAMP(3),
    "validTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LocalityPostalCode_pkey" PRIMARY KEY ("localityId", "postalCode"),
    CONSTRAINT "LocalityPostalCode_confidence_range" CHECK ("confidence" IS NULL OR ("confidence" >= 0 AND "confidence" <= 1))
);

CREATE TABLE "AdministrativeAreaPostalCode" (
    "administrativeAreaId" TEXT NOT NULL,
    "postalCode" VARCHAR(6) NOT NULL,
    "sourceId" TEXT NOT NULL,
    "confidence" DECIMAL(4,3),
    "evidence" JSONB,
    "validFrom" TIMESTAMP(3),
    "validTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AdministrativeAreaPostalCode_pkey" PRIMARY KEY ("administrativeAreaId", "postalCode", "sourceId"),
    CONSTRAINT "AdministrativeAreaPostalCode_confidence_range" CHECK ("confidence" IS NULL OR ("confidence" >= 0 AND "confidence" <= 1))
);

CREATE TABLE "LocationImportRun" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "status" "LocationImportStatus" NOT NULL,
    "mode" "LocationImportMode" NOT NULL,
    "sourceUri" TEXT NOT NULL,
    "checksumSha256" TEXT,
    "schemaVersion" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "rowsRead" INTEGER NOT NULL DEFAULT 0,
    "rowsAccepted" INTEGER NOT NULL DEFAULT 0,
    "rowsRejected" INTEGER NOT NULL DEFAULT 0,
    "rowsInserted" INTEGER NOT NULL DEFAULT 0,
    "rowsUpdated" INTEGER NOT NULL DEFAULT 0,
    "rejectionReportUri" TEXT,
    "errorSummary" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LocationImportRun_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "LocationImportRun_counts_nonnegative" CHECK ("rowsRead" >= 0 AND "rowsAccepted" >= 0 AND "rowsRejected" >= 0 AND "rowsInserted" >= 0 AND "rowsUpdated" >= 0)
);

CREATE TABLE "Requirement" (
    "id" TEXT NOT NULL,
    "cityId" TEXT NOT NULL,
    "intent" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "subtype" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phoneCiphertext" BYTEA NOT NULL,
    "phoneLast4" VARCHAR(4) NOT NULL,
    "consentText" TEXT NOT NULL,
    "consentedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "idempotencyKey" TEXT,
    "retentionUntil" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Requirement_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Requirement_phoneLast4_format" CHECK ("phoneLast4" ~ '^[0-9]{4}$'),
    CONSTRAINT "Requirement_phoneCiphertext_envelope" CHECK (octet_length("phoneCiphertext") BETWEEN 40 AND 47 AND substring("phoneCiphertext" FROM 1 FOR 4) = decode('41525131', 'hex')),
    CONSTRAINT "Requirement_retention_after_creation" CHECK ("retentionUntil" > "createdAt")
);

CREATE TABLE "RequirementLocality" (
    "requirementId" TEXT NOT NULL,
    "localityId" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "RequirementLocality_pkey" PRIMARY KEY ("requirementId", "localityId"),
    CONSTRAINT "RequirementLocality_priority_nonnegative" CHECK ("priority" >= 0)
);

ALTER TABLE "Locality"
    ADD COLUMN "stableKey" TEXT,
    ADD COLUMN "kind" "LocalityKind" NOT NULL DEFAULT 'NEIGHBOURHOOD',
    ADD COLUMN "sourceId" TEXT,
    ADD COLUMN "sourceFeatureId" TEXT,
    ADD COLUMN "confidence" DECIMAL(4,3),
    ADD COLUMN "reviewedAt" TIMESTAMP(3),
    ADD COLUMN "retiredAt" TIMESTAMP(3),
    ADD COLUMN "centroid" geography(Point,4326),
    ADD COLUMN "boundary" geometry(MultiPolygon,4326),
    ADD CONSTRAINT "Locality_confidence_range" CHECK ("confidence" IS NULL OR ("confidence" >= 0 AND "confidence" <= 1));

-- Existing coordinates are point estimates. Populate the spatial centroid but
-- do not invent a polygon from bbox text.
UPDATE "Locality"
SET "centroid" = ST_SetSRID(ST_MakePoint("longitude"::double precision, "latitude"::double precision), 4326)::geography
WHERE "latitude" IS NOT NULL AND "longitude" IS NOT NULL;

ALTER TABLE "Listing"
    ADD COLUMN "digipin" VARCHAR(10),
    ADD COLUMN "publicLatitude" DECIMAL(9,6),
    ADD COLUMN "publicLongitude" DECIMAL(9,6),
    ADD COLUMN "locationPrecision" "GeocodePrecision" NOT NULL DEFAULT 'LOCALITY',
    ADD COLUMN "coordinateVisibility" "CoordinateVisibility" NOT NULL DEFAULT 'LOCALITY_APPROXIMATE',
    ADD COLUMN "locationVerifiedAt" TIMESTAMP(3),
    ADD CONSTRAINT "Listing_coordinate_pair" CHECK (("latitude" IS NULL) = ("longitude" IS NULL)),
    ADD CONSTRAINT "Listing_public_coordinate_pair" CHECK (("publicLatitude" IS NULL) = ("publicLongitude" IS NULL)),
    ADD CONSTRAINT "Listing_digipin_format" CHECK ("digipin" IS NULL OR "digipin" ~ '^[23456789CJKLMPFT]{10}$');

-- Remove malformed legacy values before narrowing and adding the FK. Valid PINs
-- from locality arrays and listings are materialized below.
UPDATE "Listing" SET "postalCode" = NULL WHERE "postalCode" IS NOT NULL AND "postalCode" !~ '^[1-9][0-9]{5}$';
ALTER TABLE "Listing" ALTER COLUMN "postalCode" TYPE VARCHAR(6);

-- One explicit source describes the legacy fixtures. It is intentionally marked
-- as demo data; it must not be confused with an India Post import.
INSERT INTO "LocationSource" (
    "id", "key", "name", "publisher", "sourceUrl", "licenseName", "attribution",
    "retrievedAt", "status", "metadata", "createdAt", "updatedAt"
) VALUES (
    'locsrc_fixture_20260830',
    'architech-fixture-location-registry-v1',
    'Architech demo location registry',
    'Architech',
    'https://github.com/jatinpruthvi/Architech/tree/main/prisma',
    'MIT (application fixtures); upstream facts retain their own attribution',
    'Demo locality/PIN mappings; coordinates © OpenStreetMap contributors',
    TIMESTAMP '2026-08-26 00:00:00',
    'ACTIVE',
    '{"authority":"demo-only","postalVerification":"pending India Post reconciliation"}'::jsonb,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
) ON CONFLICT ("key") DO NOTHING;

UPDATE "Locality" AS locality
SET "stableKey" = CONCAT(COALESCE(city."country", 'IN'), ':', city."slug", ':', locality."slug"),
    "sourceId" = source."id"
FROM "City" AS city, "LocationSource" AS source
WHERE locality."cityId" = city."id"
  AND source."key" = 'architech-fixture-location-registry-v1'
  AND locality."stableKey" IS NULL;

INSERT INTO "PostalCode" ("code", "sourceId", "createdAt", "updatedAt")
SELECT DISTINCT candidate."code", source."id", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM (
    SELECT UNNEST(locality."pincodes")::VARCHAR(6) AS "code" FROM "Locality" AS locality
    UNION
    SELECT listing."postalCode"::VARCHAR(6) AS "code" FROM "Listing" AS listing WHERE listing."postalCode" IS NOT NULL
) AS candidate
CROSS JOIN "LocationSource" AS source
WHERE source."key" = 'architech-fixture-location-registry-v1'
  AND candidate."code" ~ '^[1-9][0-9]{5}$'
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "LocalityPostalCode" (
    "localityId", "postalCode", "linkType", "isPrimary", "confidence", "sourceId", "evidence", "createdAt", "updatedAt"
)
SELECT locality."id", pin."code"::VARCHAR(6), 'MANUAL', pin."ordinality" = 1, 0.500, source."id",
       '{"status":"fixture; pending authoritative reconciliation"}'::jsonb,
       CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Locality" AS locality
CROSS JOIN LATERAL UNNEST(locality."pincodes") WITH ORDINALITY AS pin("code", "ordinality")
CROSS JOIN "LocationSource" AS source
WHERE source."key" = 'architech-fixture-location-registry-v1'
  AND pin."code" ~ '^[1-9][0-9]{5}$'
ON CONFLICT ("localityId", "postalCode") DO NOTHING;

-- Promote legacy names and aliases into queryable rows. `DISTINCT ON` avoids a
-- Hindi name repeated in the old aliases array violating the normalized key.
WITH candidates AS (
    SELECT locality."id" AS "localityId", locality."name", LOWER(TRIM(locality."name")) AS "normalizedName",
           'en'::VARCHAR(16) AS "languageCode", 'Latn'::VARCHAR(8) AS "scriptCode",
           'OFFICIAL'::"LocalityAliasType" AS "type", true AS "isPreferred"
    FROM "Locality" AS locality
    UNION ALL
    SELECT locality."id", locality."hindiName", TRIM(locality."hindiName"), 'hi', 'Deva', 'TRANSLITERATION', true
    FROM "Locality" AS locality WHERE locality."hindiName" IS NOT NULL AND TRIM(locality."hindiName") <> ''
    UNION ALL
    SELECT locality."id", legacy."name", LOWER(TRIM(legacy."name")), 'und', NULL, 'SEARCH', false
    FROM "Locality" AS locality
    CROSS JOIN LATERAL UNNEST(locality."aliases") AS legacy("name")
    WHERE TRIM(legacy."name") <> ''
), deduplicated AS (
    SELECT DISTINCT ON ("localityId", "normalizedName", "languageCode") *
    FROM candidates
    ORDER BY "localityId", "normalizedName", "languageCode", "isPreferred" DESC
)
INSERT INTO "LocalityAlias" (
    "id", "localityId", "name", "normalizedName", "languageCode", "scriptCode", "type", "isPreferred", "sourceId", "createdAt", "updatedAt"
)
SELECT CONCAT('localias_', MD5(deduplicated."localityId" || ':' || deduplicated."normalizedName" || ':' || deduplicated."languageCode")),
       deduplicated."localityId", deduplicated."name", deduplicated."normalizedName", deduplicated."languageCode",
       deduplicated."scriptCode", deduplicated."type", deduplicated."isPreferred", source."id", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM deduplicated
CROSS JOIN "LocationSource" AS source
WHERE source."key" = 'architech-fixture-location-registry-v1'
ON CONFLICT ("localityId", "normalizedName", "languageCode") DO NOTHING;

CREATE UNIQUE INDEX "AdministrativeArea_sourceId_type_code_key" ON "AdministrativeArea"("sourceId", "type", "code");
CREATE UNIQUE INDEX "AdministrativeArea_sourceId_sourceFeatureId_key" ON "AdministrativeArea"("sourceId", "sourceFeatureId");
CREATE INDEX "AdministrativeArea_parentId_type_idx" ON "AdministrativeArea"("parentId", "type");
CREATE INDEX "AdministrativeArea_name_type_idx" ON "AdministrativeArea"("name", "type");
CREATE INDEX "AdministrativeArea_boundary_gist" ON "AdministrativeArea" USING GIST ("boundary");
CREATE INDEX "CityAdministrativeArea_administrativeAreaId_role_idx" ON "CityAdministrativeArea"("administrativeAreaId", "role");
CREATE INDEX "LocalityAdministrativeArea_administrativeAreaId_role_idx" ON "LocalityAdministrativeArea"("administrativeAreaId", "role");
CREATE INDEX "LocalityAlias_normalizedName_idx" ON "LocalityAlias"("normalizedName");
CREATE INDEX "PostalCode_sourceId_idx" ON "PostalCode"("sourceId");
CREATE UNIQUE INDEX "PostOffice_sourceId_sourceRecordId_key" ON "PostOffice"("sourceId", "sourceRecordId");
CREATE INDEX "PostOffice_postalCode_name_idx" ON "PostOffice"("postalCode", "name");
CREATE INDEX "PostOffice_districtName_stateName_idx" ON "PostOffice"("districtName", "stateName");
CREATE INDEX "PostOffice_localityId_idx" ON "PostOffice"("localityId");
CREATE INDEX "LocalityPostalCode_postalCode_isPrimary_idx" ON "LocalityPostalCode"("postalCode", "isPrimary");
CREATE INDEX "AdministrativeAreaPostalCode_postalCode_validTo_idx" ON "AdministrativeAreaPostalCode"("postalCode", "validTo");
CREATE INDEX "AdministrativeAreaPostalCode_sourceId_validTo_idx" ON "AdministrativeAreaPostalCode"("sourceId", "validTo");
CREATE INDEX "LocationImportRun_sourceId_startedAt_idx" ON "LocationImportRun"("sourceId", "startedAt");
CREATE INDEX "LocationImportRun_status_startedAt_idx" ON "LocationImportRun"("status", "startedAt");
CREATE UNIQUE INDEX "Requirement_idempotencyKey_key" ON "Requirement"("idempotencyKey");
CREATE INDEX "Requirement_cityId_status_createdAt_idx" ON "Requirement"("cityId", "status", "createdAt");
CREATE INDEX "Requirement_retentionUntil_idx" ON "Requirement"("retentionUntil");
CREATE INDEX "RequirementLocality_localityId_idx" ON "RequirementLocality"("localityId");
CREATE UNIQUE INDEX "Locality_stableKey_key" ON "Locality"("stableKey");
CREATE UNIQUE INDEX "Locality_sourceId_sourceFeatureId_key" ON "Locality"("sourceId", "sourceFeatureId");
CREATE INDEX "Locality_sourceId_idx" ON "Locality"("sourceId");
CREATE INDEX "Locality_centroid_gist" ON "Locality" USING GIST ("centroid");
CREATE INDEX "Locality_boundary_gist" ON "Locality" USING GIST ("boundary");

ALTER TABLE "AdministrativeArea" ADD CONSTRAINT "AdministrativeArea_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "AdministrativeArea"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AdministrativeArea" ADD CONSTRAINT "AdministrativeArea_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "LocationSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CityAdministrativeArea" ADD CONSTRAINT "CityAdministrativeArea_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CityAdministrativeArea" ADD CONSTRAINT "CityAdministrativeArea_administrativeAreaId_fkey" FOREIGN KEY ("administrativeAreaId") REFERENCES "AdministrativeArea"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CityAdministrativeArea" ADD CONSTRAINT "CityAdministrativeArea_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "LocationSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LocalityAdministrativeArea" ADD CONSTRAINT "LocalityAdministrativeArea_localityId_fkey" FOREIGN KEY ("localityId") REFERENCES "Locality"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LocalityAdministrativeArea" ADD CONSTRAINT "LocalityAdministrativeArea_administrativeAreaId_fkey" FOREIGN KEY ("administrativeAreaId") REFERENCES "AdministrativeArea"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LocalityAdministrativeArea" ADD CONSTRAINT "LocalityAdministrativeArea_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "LocationSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LocalityAlias" ADD CONSTRAINT "LocalityAlias_localityId_fkey" FOREIGN KEY ("localityId") REFERENCES "Locality"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LocalityAlias" ADD CONSTRAINT "LocalityAlias_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "LocationSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PostalCode" ADD CONSTRAINT "PostalCode_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "LocationSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PostOffice" ADD CONSTRAINT "PostOffice_postalCode_fkey" FOREIGN KEY ("postalCode") REFERENCES "PostalCode"("code") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PostOffice" ADD CONSTRAINT "PostOffice_administrativeAreaId_fkey" FOREIGN KEY ("administrativeAreaId") REFERENCES "AdministrativeArea"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PostOffice" ADD CONSTRAINT "PostOffice_localityId_fkey" FOREIGN KEY ("localityId") REFERENCES "Locality"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PostOffice" ADD CONSTRAINT "PostOffice_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "LocationSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LocalityPostalCode" ADD CONSTRAINT "LocalityPostalCode_localityId_fkey" FOREIGN KEY ("localityId") REFERENCES "Locality"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LocalityPostalCode" ADD CONSTRAINT "LocalityPostalCode_postalCode_fkey" FOREIGN KEY ("postalCode") REFERENCES "PostalCode"("code") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LocalityPostalCode" ADD CONSTRAINT "LocalityPostalCode_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "LocationSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AdministrativeAreaPostalCode" ADD CONSTRAINT "AdministrativeAreaPostalCode_administrativeAreaId_fkey" FOREIGN KEY ("administrativeAreaId") REFERENCES "AdministrativeArea"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AdministrativeAreaPostalCode" ADD CONSTRAINT "AdministrativeAreaPostalCode_postalCode_fkey" FOREIGN KEY ("postalCode") REFERENCES "PostalCode"("code") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AdministrativeAreaPostalCode" ADD CONSTRAINT "AdministrativeAreaPostalCode_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "LocationSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LocationImportRun" ADD CONSTRAINT "LocationImportRun_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "LocationSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Locality" ADD CONSTRAINT "Locality_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "LocationSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_postalCode_fkey" FOREIGN KEY ("postalCode") REFERENCES "PostalCode"("code") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Requirement" ADD CONSTRAINT "Requirement_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RequirementLocality" ADD CONSTRAINT "RequirementLocality_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "Requirement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RequirementLocality" ADD CONSTRAINT "RequirementLocality_localityId_fkey" FOREIGN KEY ("localityId") REFERENCES "Locality"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
