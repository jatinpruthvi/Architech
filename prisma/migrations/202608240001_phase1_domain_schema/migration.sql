-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "ListingLifecycle" AS ENUM ('DRAFT', 'IN_REVIEW', 'ACTIVE', 'SOLD', 'EXPIRED', 'REMOVED', 'DUPLICATE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('DEMO', 'SOURCE_REVIEWED', 'VERIFIED_PARTNER', 'RERA_VERIFIED', 'DISPUTED', 'STALE');

-- CreateEnum
CREATE TYPE "TranslationStatus" AS ENUM ('ENGLISH_ONLY', 'MACHINE_DRAFT', 'HUMAN_REVIEW_PENDING', 'REVIEWED');

-- CreateEnum
CREATE TYPE "MediaModerationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'TAKEDOWN_REQUESTED', 'DELETED');

-- CreateEnum
CREATE TYPE "PropertyType" AS ENUM ('APARTMENT', 'ROWHOUSE', 'VILLA', 'PENTHOUSE', 'PLOT');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('BUYER', 'BROKER_MEMBER', 'BROKER_ADMIN', 'MODERATOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "LeadMode" AS ENUM ('MASKED', 'DIRECT_CONSENTED');

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'ACKNOWLEDGED', 'REPLIED', 'CLOSED', 'DELETED');

-- CreateTable
CREATE TABLE "City" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "hindiName" TEXT,
    "state" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'IN',
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "City_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Locality" (
    "id" TEXT NOT NULL,
    "cityId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "hindiName" TEXT,
    "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "note" TEXT NOT NULL,
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "bbox" TEXT,
    "landmarks" JSONB,
    "demoHomeCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Locality_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrokerOrganization" (
    "id" TEXT NOT NULL,
    "cityId" TEXT,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "legalName" TEXT,
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'SOURCE_REVIEWED',
    "reraNumber" TEXT,
    "website" TEXT,
    "phoneMasked" TEXT,
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrokerOrganization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'BUYER',
    "phoneMasked" TEXT,
    "emailVerified" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrokerUser" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'BROKER_MEMBER',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrokerUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReraRecord" (
    "id" TEXT NOT NULL,
    "registrationNumber" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'Gujarat',
    "promoterName" TEXT,
    "projectName" TEXT,
    "sourceUrl" TEXT,
    "retrievedAt" TIMESTAMP(3),
    "parserVersion" TEXT,
    "confidence" DECIMAL(5,4),
    "evidence" JSONB,
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'SOURCE_REVIEWED',
    "correctionStatus" TEXT DEFAULT 'none',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReraRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Listing" (
    "id" TEXT NOT NULL,
    "stableId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "cityId" TEXT NOT NULL,
    "localityId" TEXT NOT NULL,
    "brokerOrgId" TEXT,
    "reraRecordId" TEXT,
    "title" TEXT NOT NULL,
    "titleHi" TEXT,
    "description" TEXT NOT NULL,
    "descriptionHi" TEXT,
    "note" TEXT,
    "lifecycle" "ListingLifecycle" NOT NULL DEFAULT 'DRAFT',
    "verification" "VerificationStatus" NOT NULL DEFAULT 'DEMO',
    "translationStatus" "TranslationStatus" NOT NULL DEFAULT 'ENGLISH_ONLY',
    "propertyType" "PropertyType" NOT NULL DEFAULT 'APARTMENT',
    "priceInr" INTEGER NOT NULL,
    "priceLabel" TEXT NOT NULL,
    "pricePerSqft" TEXT,
    "bhk" INTEGER,
    "areaSqft" INTEGER,
    "availability" TEXT,
    "addressLocality" TEXT,
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "sourceSummary" TEXT,
    "meaningfulUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "canonicalToListingId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Listing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropertyMedia" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'image',
    "url" TEXT NOT NULL,
    "alt" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "blurHash" TEXT,
    "derivatives" JSONB,
    "licenseEvidence" TEXT,
    "exifStripped" BOOLEAN NOT NULL DEFAULT false,
    "moderationStatus" "MediaModerationStatus" NOT NULL DEFAULT 'PENDING',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PropertyMedia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "userId" TEXT,
    "organizationId" TEXT,
    "mode" "LeadMode" NOT NULL DEFAULT 'MASKED',
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "name" TEXT NOT NULL,
    "phoneMasked" TEXT,
    "email" TEXT,
    "message" TEXT NOT NULL,
    "consentText" TEXT NOT NULL,
    "idempotencyKey" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedSearch" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "cityId" TEXT,
    "localityId" TEXT,
    "query" TEXT,
    "filters" JSONB NOT NULL,
    "notify" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavedSearch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT,
    "organizationId" TEXT,
    "listingId" TEXT,
    "reraRecordId" TEXT,
    "leadId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "metadata" JSONB,
    "ipHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "City_slug_key" ON "City"("slug");

-- CreateIndex
CREATE INDEX "City_state_country_idx" ON "City"("state", "country");

-- CreateIndex
CREATE INDEX "Locality_name_idx" ON "Locality"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Locality_cityId_slug_key" ON "Locality"("cityId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "BrokerOrganization_slug_key" ON "BrokerOrganization"("slug");

-- CreateIndex
CREATE INDEX "BrokerOrganization_verificationStatus_idx" ON "BrokerOrganization"("verificationStatus");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "BrokerUser_organizationId_active_idx" ON "BrokerUser"("organizationId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "BrokerUser_userId_organizationId_key" ON "BrokerUser"("userId", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "ReraRecord_registrationNumber_key" ON "ReraRecord"("registrationNumber");

-- CreateIndex
CREATE INDEX "ReraRecord_state_verificationStatus_idx" ON "ReraRecord"("state", "verificationStatus");

-- CreateIndex
CREATE UNIQUE INDEX "Listing_stableId_key" ON "Listing"("stableId");

-- CreateIndex
CREATE UNIQUE INDEX "Listing_slug_key" ON "Listing"("slug");

-- CreateIndex
CREATE INDEX "Listing_cityId_lifecycle_idx" ON "Listing"("cityId", "lifecycle");

-- CreateIndex
CREATE INDEX "Listing_localityId_lifecycle_idx" ON "Listing"("localityId", "lifecycle");

-- CreateIndex
CREATE INDEX "Listing_verification_idx" ON "Listing"("verification");

-- CreateIndex
CREATE INDEX "Listing_priceInr_idx" ON "Listing"("priceInr");

-- CreateIndex
CREATE INDEX "Listing_bhk_idx" ON "Listing"("bhk");

-- CreateIndex
CREATE INDEX "Listing_meaningfulUpdatedAt_idx" ON "Listing"("meaningfulUpdatedAt");

-- CreateIndex
CREATE INDEX "PropertyMedia_listingId_sortOrder_idx" ON "PropertyMedia"("listingId", "sortOrder");

-- CreateIndex
CREATE INDEX "PropertyMedia_moderationStatus_idx" ON "PropertyMedia"("moderationStatus");

-- CreateIndex
CREATE UNIQUE INDEX "Lead_idempotencyKey_key" ON "Lead"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Lead_listingId_status_idx" ON "Lead"("listingId", "status");

-- CreateIndex
CREATE INDEX "Lead_organizationId_status_idx" ON "Lead"("organizationId", "status");

-- CreateIndex
CREATE INDEX "Lead_createdAt_idx" ON "Lead"("createdAt");

-- CreateIndex
CREATE INDEX "SavedSearch_userId_notify_idx" ON "SavedSearch"("userId", "notify");

-- CreateIndex
CREATE INDEX "SavedSearch_cityId_idx" ON "SavedSearch"("cityId");

-- CreateIndex
CREATE INDEX "SavedSearch_localityId_idx" ON "SavedSearch"("localityId");

-- CreateIndex
CREATE INDEX "AuditEvent_entityType_entityId_idx" ON "AuditEvent"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditEvent_createdAt_idx" ON "AuditEvent"("createdAt");

-- CreateIndex
CREATE INDEX "AuditEvent_actorUserId_idx" ON "AuditEvent"("actorUserId");

-- AddForeignKey
ALTER TABLE "Locality" ADD CONSTRAINT "Locality_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrokerOrganization" ADD CONSTRAINT "BrokerOrganization_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrokerUser" ADD CONSTRAINT "BrokerUser_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrokerUser" ADD CONSTRAINT "BrokerUser_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "BrokerOrganization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_localityId_fkey" FOREIGN KEY ("localityId") REFERENCES "Locality"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_brokerOrgId_fkey" FOREIGN KEY ("brokerOrgId") REFERENCES "BrokerOrganization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_reraRecordId_fkey" FOREIGN KEY ("reraRecordId") REFERENCES "ReraRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyMedia" ADD CONSTRAINT "PropertyMedia_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "BrokerOrganization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedSearch" ADD CONSTRAINT "SavedSearch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedSearch" ADD CONSTRAINT "SavedSearch_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedSearch" ADD CONSTRAINT "SavedSearch_localityId_fkey" FOREIGN KEY ("localityId") REFERENCES "Locality"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "BrokerOrganization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_reraRecordId_fkey" FOREIGN KEY ("reraRecordId") REFERENCES "ReraRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

