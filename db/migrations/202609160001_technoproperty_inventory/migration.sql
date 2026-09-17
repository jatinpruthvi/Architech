-- CreateEnum
CREATE TYPE "TechnoCategory" AS ENUM ('RESIDENTIAL_RENT', 'RESIDENTIAL_SELL', 'COMMERCIAL_RENT', 'COMMERCIAL_SELL', 'PREMIUM', 'IMPORTANT');
CREATE TYPE "TechnoSourceStatus" AS ENUM ('ACTIVE', 'RENTED_OUT', 'SOLD', 'REMOVED');
CREATE TYPE "TechnoListingType" AS ENUM ('OWNER', 'BROKER');
CREATE TYPE "TechnoRevealChannel" AS ENUM ('CLICK_TO_DIAL', 'WHATSAPP', 'REVEAL_ONLY');

-- CreateTable: TechnoProperty
CREATE TABLE "TechnoProperty" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "externalId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "category" "TechnoCategory" NOT NULL,
    "propertyType" TEXT,
    "datePosted" TIMESTAMP(3),
    "address" TEXT,
    "premiseName" TEXT,
    "area" TEXT,
    "rentPriceRaw" TEXT,
    "rentPriceValue" BIGINT,
    "availabilityRaw" TEXT,
    "conditionRaw" TEXT,
    "propertyAge" TEXT,
    "descriptionRaw" TEXT,
    "furnitureRaw" TEXT,
    "sqftRaw" TEXT,
    "sqftValue" INTEGER,
    "keyInfo" TEXT,
    "brokerage" TEXT,
    "isRentedOut" BOOLEAN NOT NULL DEFAULT false,
    "soldOut" BOOLEAN NOT NULL DEFAULT false,
    "hasGallery" BOOLEAN NOT NULL DEFAULT false,
    "isPremium" BOOLEAN NOT NULL DEFAULT false,
    "sourceShortlisted" BOOLEAN NOT NULL DEFAULT false,
    "ownerName" TEXT,
    "ownerPhoneCipher" BYTEA,
    "ownerPhoneLast4" VARCHAR(4),
    "contactBtnId" TEXT,
    "imageUrls" JSONB,
    "sourceStatus" "TechnoSourceStatus" NOT NULL DEFAULT 'ACTIVE',
    "firstSeenAt" TIMESTAMP(3) NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL,
    "lastModifiedAt" TIMESTAMP(3) NOT NULL,
    "rowHash" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TechnoProperty_orgId_externalId_key" UNIQUE ("orgId", "externalId")
);

-- CreateTable: TechnoBrokerListing
CREATE TABLE "TechnoBrokerListing" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "externalId" TEXT,
    "orgId" TEXT NOT NULL,
    "category" "TechnoCategory" NOT NULL,
    "propertyType" TEXT,
    "datePosted" TIMESTAMP(3),
    "brokerName" TEXT,
    "estateName" TEXT,
    "brokerPhoneCipher" BYTEA,
    "brokerPhoneLast4" VARCHAR(4),
    "schemeName" TEXT,
    "landmark" TEXT,
    "address" TEXT,
    "rowHash" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "firstSeenAt" TIMESTAMP(3) NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TechnoBrokerListing_orgId_rowHash_key" UNIQUE ("orgId", "rowHash")
);

-- CreateTable: TechnoCategoryStat
CREATE TABLE "TechnoCategoryStat" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "categoryKey" TEXT NOT NULL,
    "totalActive" INTEGER NOT NULL DEFAULT 0,
    "todayCount" INTEGER NOT NULL DEFAULT 0,
    "yesterdayCount" INTEGER NOT NULL DEFAULT 0,
    "last15Days" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TechnoCategoryStat_orgId_categoryKey_key" UNIQUE ("orgId", "categoryKey")
);

-- CreateTable: TechnoContactEvent
CREATE TABLE "TechnoContactEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "brokerUserId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "listingType" "TechnoListingType" NOT NULL,
    "propertyId" TEXT,
    "brokerListingId" TEXT,
    "phoneLast4" VARCHAR(4),
    "channel" "TechnoRevealChannel" NOT NULL DEFAULT 'CLICK_TO_DIAL',
    "outcome" VARCHAR(32),
    "note" VARCHAR(500),
    "followUpAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TechnoContactEvent_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "TechnoProperty"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TechnoContactEvent_brokerListingId_fkey" FOREIGN KEY ("brokerListingId") REFERENCES "TechnoBrokerListing"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable: TechnoNote
CREATE TABLE "TechnoNote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "brokerUserId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "text" VARCHAR(1000) NOT NULL,
    "meta" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TechnoNote_brokerUserId_orgId_propertyId_key" UNIQUE ("brokerUserId", "orgId", "propertyId"),
    CONSTRAINT "TechnoNote_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "TechnoProperty"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable: TechnoShortlist
CREATE TABLE "TechnoShortlist" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "brokerUserId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TechnoShortlist_brokerUserId_orgId_propertyId_key" UNIQUE ("brokerUserId", "orgId", "propertyId"),
    CONSTRAINT "TechnoShortlist_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "TechnoProperty"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable: TechnoSavedSearch
CREATE TABLE "TechnoSavedSearch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "brokerUserId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "filterJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastNotifiedAt" TIMESTAMP(3)
);

-- CreateTable: TechnoCrawlRun
CREATE TABLE "TechnoCrawlRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "mode" TEXT NOT NULL,
    "externalCrawlId" INTEGER,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'running',
    "totalProperties" INTEGER NOT NULL DEFAULT 0,
    "newProperties" INTEGER NOT NULL DEFAULT 0,
    "updatedProperties" INTEGER NOT NULL DEFAULT 0,
    "removedProperties" INTEGER NOT NULL DEFAULT 0,
    "contactsFetched" INTEGER NOT NULL DEFAULT 0,
    "imagesFetched" INTEGER NOT NULL DEFAULT 0,
    "errors" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX "TechnoProperty_orgId_active_category_datePosted_idx" ON "TechnoProperty"("orgId", "active", "category", "datePosted");
CREATE INDEX "TechnoProperty_orgId_active_isPremium_idx" ON "TechnoProperty"("orgId", "active", "isPremium");
CREATE INDEX "TechnoProperty_orgId_active_sourceShortlisted_idx" ON "TechnoProperty"("orgId", "active", "sourceShortlisted");
CREATE INDEX "TechnoProperty_orgId_ownerPhoneLast4_idx" ON "TechnoProperty"("orgId", "ownerPhoneLast4");
CREATE INDEX "TechnoProperty_rowHash_idx" ON "TechnoProperty"("rowHash");

CREATE INDEX "TechnoBrokerListing_orgId_active_category_datePosted_idx" ON "TechnoBrokerListing"("orgId", "active", "category", "datePosted");

CREATE INDEX "TechnoContactEvent_orgId_createdAt_idx" ON "TechnoContactEvent"("orgId", "createdAt");
CREATE INDEX "TechnoContactEvent_brokerUserId_createdAt_idx" ON "TechnoContactEvent"("brokerUserId", "createdAt");
CREATE INDEX "TechnoContactEvent_propertyId_createdAt_idx" ON "TechnoContactEvent"("propertyId", "createdAt");

CREATE INDEX "TechnoNote_orgId_updatedAt_idx" ON "TechnoNote"("orgId", "updatedAt");
CREATE INDEX "TechnoSavedSearch_orgId_brokerUserId_idx" ON "TechnoSavedSearch"("orgId", "brokerUserId");
