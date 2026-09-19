-- CreateEnum
CREATE TYPE "TechnoDealType" AS ENUM ('RENT', 'SELL');
CREATE TYPE "TechnoLeadSource" AS ENUM ('WALK_IN', 'CALL', 'SOCIAL', 'REFERRAL');

-- CreateTable: TechnoBuyerLead
CREATE TABLE "TechnoBuyerLead" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "brokerUserId" TEXT NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "phoneCipher" BYTEA NOT NULL,
    "phoneLast4" VARCHAR(4) NOT NULL,
    "dealType" "TechnoDealType" NOT NULL,
    "bhk" INTEGER,
    "budgetValue" BIGINT,
    "area" VARCHAR(160),
    "furniture" VARCHAR(40),
    "moveInAt" TIMESTAMP(3),
    "source" "TechnoLeadSource" NOT NULL DEFAULT 'CALL',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);

-- Indexes
CREATE INDEX "TechnoBuyerLead_orgId_brokerUserId_createdAt_idx" ON "TechnoBuyerLead"("orgId", "brokerUserId", "createdAt");
