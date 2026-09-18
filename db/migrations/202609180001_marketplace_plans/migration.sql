-- Marketplace plans & subscriptions (spec: broker plan gate + /admin/plans).
-- The models existed in schema.prisma; this migration materializes them.

-- CreateEnum (SubscriptionStatus was also schema-only until now)
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIAL', 'ACTIVE', 'PAUSED', 'EXPIRED', 'CANCELLED');

-- CreateTable: MarketplacePlan
CREATE TABLE "MarketplacePlan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" VARCHAR(40) NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "monthlyCredits" INTEGER NOT NULL DEFAULT 0,
    "teamSeats" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "MarketplacePlan_code_key" ON "MarketplacePlan"("code");

-- CreateTable: MarketplacePlanEntitlement
CREATE TABLE "MarketplacePlanEntitlement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "planId" TEXT NOT NULL,
    "key" VARCHAR(64) NOT NULL,
    "limit" INTEGER,
    "metadata" JSONB,

    CONSTRAINT "MarketplacePlanEntitlement_planId_fkey" FOREIGN KEY ("planId") REFERENCES "MarketplacePlan"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "MarketplacePlanEntitlement_planId_key_key" ON "MarketplacePlanEntitlement"("planId", "key");

-- CreateTable: MarketplaceSubscription
CREATE TABLE "MarketplaceSubscription" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "planId" TEXT NOT NULL,
    "userId" TEXT,
    "organizationId" TEXT,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'TRIAL',
    "provider" VARCHAR(40),
    "providerRef" VARCHAR(140),
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "renewsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketplaceSubscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "MarketplacePlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MarketplaceSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MarketplaceSubscription_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "BrokerOrganization"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "MarketplaceSubscription_userId_status_expiresAt_idx" ON "MarketplaceSubscription"("userId", "status", "expiresAt");
CREATE INDEX "MarketplaceSubscription_organizationId_status_expiresAt_idx" ON "MarketplaceSubscription"("organizationId", "status", "expiresAt");

-- CreateTable: UsageLedger
CREATE TABLE "UsageLedger" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "organizationId" TEXT,
    "subscriptionId" TEXT,
    "key" VARCHAR(64) NOT NULL,
    "delta" INTEGER NOT NULL,
    "idempotencyKey" VARCHAR(140) NOT NULL,
    "reason" VARCHAR(140),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UsageLedger_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UsageLedger_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "BrokerOrganization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UsageLedger_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "MarketplaceSubscription"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "UsageLedger_idempotencyKey_key" ON "UsageLedger"("idempotencyKey");
CREATE INDEX "UsageLedger_organizationId_key_createdAt_idx" ON "UsageLedger"("organizationId", "key", "createdAt");
CREATE INDEX "UsageLedger_userId_key_createdAt_idx" ON "UsageLedger"("userId", "key", "createdAt");
