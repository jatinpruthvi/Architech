-- Broker Channel / cross-broker channel foundation.
--
-- This migration creates the durable tables for sanitized demand/supply
-- publication, deterministic cross-broker matching, deal close, management
-- commission entries, and ERPNext close-write idempotency. Customer PII stays in
-- the private lead/requirement/listing source tables; cross-org channel tables
-- carry only structured real-estate facts and broker business identifiers.

CREATE TYPE "ChannelRequestType" AS ENUM ('DEMAND', 'SUPPLY');
CREATE TYPE "ChannelRequestStatus" AS ENUM ('DRAFT', 'OPEN', 'MATCHED', 'CLOSED', 'CANCELLED', 'EXPIRED');
CREATE TYPE "ChannelMatchStatus" AS ENUM ('SUGGESTED', 'ACCEPTED', 'REJECTED', 'DEAL_CREATED');
CREATE TYPE "ChannelDealStatus" AS ENUM ('OPEN', 'PENDING_OTHER_CLOSE', 'CLOSED', 'CANCELLED');
CREATE TYPE "ChannelDealCloseMode" AS ENUM ('SINGLE', 'DUAL');
CREATE TYPE "ErpnextSyncStatus" AS ENUM ('PENDING', 'IN_FLIGHT', 'SUCCESS', 'FAILED', 'RECONCILED');
CREATE TYPE "CommissionEntryType" AS ENUM ('COMMISSION_INCOME', 'COMMISSION_EXPENSE');

ALTER TABLE "BrokerOrganization"
    ADD COLUMN "businessPhoneE164" TEXT,
    ADD COLUMN "businessPhoneMasked" TEXT;

CREATE TABLE "ChannelRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "type" "ChannelRequestType" NOT NULL,
    "cityId" TEXT NOT NULL,
    "localitySlug" TEXT,
    "intent" TEXT NOT NULL,
    "propertyType" TEXT NOT NULL,
    "bhkMin" INTEGER,
    "bhkMax" INTEGER,
    "areaMinSqft" INTEGER,
    "areaMaxSqft" INTEGER,
    "budgetMinInr" BIGINT,
    "budgetMaxInr" BIGINT,
    "priceInr" BIGINT,
    "detailSummary" TEXT NOT NULL,
    "status" "ChannelRequestStatus" NOT NULL DEFAULT 'DRAFT',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "revision" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChannelRequest_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "BrokerOrganization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ChannelRequest_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ChannelRequest_demand_shape_chk" CHECK (
        ("type" = 'DEMAND' AND "budgetMinInr" IS NOT NULL AND "budgetMaxInr" IS NOT NULL AND "priceInr" IS NULL)
        OR ("type" = 'SUPPLY' AND "priceInr" IS NOT NULL AND "budgetMinInr" IS NULL AND "budgetMaxInr" IS NULL)
    ),
    CONSTRAINT "ChannelRequest_budget_order_chk" CHECK ("budgetMinInr" IS NULL OR "budgetMaxInr" IS NULL OR "budgetMinInr" <= "budgetMaxInr"),
    CONSTRAINT "ChannelRequest_bhk_order_chk" CHECK ("bhkMin" IS NULL OR "bhkMax" IS NULL OR "bhkMin" <= "bhkMax"),
    CONSTRAINT "ChannelRequest_area_order_chk" CHECK ("areaMinSqft" IS NULL OR "areaMaxSqft" IS NULL OR "areaMinSqft" <= "areaMaxSqft")
);

CREATE TABLE "ChannelRequestSource" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "channelRequestId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "sourceListingId" TEXT,
    "sourceRequirementId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChannelRequestSource_channelRequestId_fkey" FOREIGN KEY ("channelRequestId") REFERENCES "ChannelRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ChannelRequestSource_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "BrokerOrganization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ChannelRequestSource_sourceListingId_fkey" FOREIGN KEY ("sourceListingId") REFERENCES "Listing"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ChannelRequestSource_sourceRequirementId_fkey" FOREIGN KEY ("sourceRequirementId") REFERENCES "Requirement"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "ChannelMatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "demandRequestId" TEXT NOT NULL,
    "supplyRequestId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "reasons" JSONB NOT NULL,
    "status" "ChannelMatchStatus" NOT NULL DEFAULT 'SUGGESTED',
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChannelMatch_demandRequestId_fkey" FOREIGN KEY ("demandRequestId") REFERENCES "ChannelRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ChannelMatch_supplyRequestId_fkey" FOREIGN KEY ("supplyRequestId") REFERENCES "ChannelRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ChannelMatch_score_chk" CHECK ("score" >= 0 AND "score" <= 100),
    CONSTRAINT "ChannelMatch_direction_chk" CHECK ("demandRequestId" <> "supplyRequestId")
);

CREATE TABLE "ChannelDeal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "matchId" TEXT NOT NULL,
    "demandOrganizationId" TEXT NOT NULL,
    "supplyOrganizationId" TEXT NOT NULL,
    "demandContactUserId" TEXT,
    "supplyContactUserId" TEXT,
    "status" "ChannelDealStatus" NOT NULL DEFAULT 'OPEN',
    "closeMode" "ChannelDealCloseMode" NOT NULL DEFAULT 'DUAL',
    "splitAgreement" JSONB,
    "totalCommissionInr" BIGINT,
    "demandBrokerShareInr" BIGINT,
    "supplyBrokerShareInr" BIGINT,
    "demandBrokerConfirmAt" TIMESTAMP(3),
    "supplyBrokerConfirmAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "closeVersion" INTEGER NOT NULL DEFAULT 1,
    "erpnextSyncStatus" "ErpnextSyncStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChannelDeal_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "ChannelMatch"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ChannelDeal_demandOrganizationId_fkey" FOREIGN KEY ("demandOrganizationId") REFERENCES "BrokerOrganization"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ChannelDeal_supplyOrganizationId_fkey" FOREIGN KEY ("supplyOrganizationId") REFERENCES "BrokerOrganization"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ChannelDeal_orgs_distinct_chk" CHECK ("demandOrganizationId" <> "supplyOrganizationId"),
    CONSTRAINT "ChannelDeal_split_sum_chk" CHECK (
        "totalCommissionInr" IS NULL
        OR ("demandBrokerShareInr" IS NOT NULL AND "supplyBrokerShareInr" IS NOT NULL AND "demandBrokerShareInr" + "supplyBrokerShareInr" = "totalCommissionInr")
    )
);

CREATE TABLE "CommissionEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "entryType" "CommissionEntryType" NOT NULL,
    "amountInr" BIGINT NOT NULL,
    "employeeId" TEXT,
    "description" TEXT NOT NULL,
    "entryDate" TIMESTAMP(3) NOT NULL,
    "recordedById" TEXT NOT NULL,
    "erpnextDocId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CommissionEntry_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "BrokerOrganization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CommissionEntry_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "ChannelDeal"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "ErpnextCloseWrite" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "channelDealId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "status" "ErpnextSyncStatus" NOT NULL DEFAULT 'PENDING',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "nextRetryAt" TIMESTAMP(3),
    "erpnextDocId" TEXT,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ErpnextCloseWrite_channelDealId_fkey" FOREIGN KEY ("channelDealId") REFERENCES "ChannelDeal"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ErpnextCloseWrite_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "BrokerOrganization"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "InboundProviderEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InboundProviderEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "BrokerOrganization"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "ChannelNotification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT,
    "eventType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChannelNotification_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "BrokerOrganization"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ChannelRequestSource_channelRequestId_key" ON "ChannelRequestSource" ("channelRequestId");
CREATE UNIQUE INDEX "ChannelRequestSource_sourceListingId_key" ON "ChannelRequestSource" ("sourceListingId");
CREATE UNIQUE INDEX "ChannelRequestSource_sourceRequirementId_key" ON "ChannelRequestSource" ("sourceRequirementId");
CREATE INDEX "ChannelRequestSource_organizationId_idx" ON "ChannelRequestSource" ("organizationId");
CREATE INDEX "ChannelRequestSource_sourceRequirementId_idx" ON "ChannelRequestSource" ("sourceRequirementId");
CREATE INDEX "Requirement_organizationId_status_createdAt_idx" ON "Requirement" ("organizationId", "status", "createdAt");
CREATE UNIQUE INDEX "ChannelMatch_demandRequestId_supplyRequestId_key" ON "ChannelMatch" ("demandRequestId", "supplyRequestId");
CREATE UNIQUE INDEX "ChannelDeal_matchId_key" ON "ChannelDeal" ("matchId");
CREATE UNIQUE INDEX "ErpnextCloseWrite_idempotencyKey_key" ON "ErpnextCloseWrite" ("idempotencyKey");
CREATE UNIQUE INDEX "InboundProviderEvent_provider_externalId_key" ON "InboundProviderEvent" ("provider", "externalId");
CREATE INDEX "InboundProviderEvent_organizationId_processedAt_idx" ON "InboundProviderEvent" ("organizationId", "processedAt");
CREATE INDEX "ChannelNotification_organizationId_readAt_createdAt_idx" ON "ChannelNotification" ("organizationId", "readAt", "createdAt");
CREATE INDEX "ChannelNotification_entityType_entityId_idx" ON "ChannelNotification" ("entityType", "entityId");

CREATE INDEX "ChannelRequest_organizationId_status_idx" ON "ChannelRequest" ("organizationId", "status");
CREATE INDEX "ChannelRequest_cityId_localitySlug_type_intent_propertyType_status_idx" ON "ChannelRequest" ("cityId", "localitySlug", "type", "intent", "propertyType", "status");
CREATE INDEX "ChannelRequest_top_supply_price_idx" ON "ChannelRequest" ("type", "status", "cityId", "intent", "propertyType", "priceInr");
CREATE INDEX "ChannelRequest_top_demand_budget_idx" ON "ChannelRequest" ("type", "status", "cityId", "intent", "propertyType", "budgetMaxInr");
CREATE INDEX "ChannelRequest_top_bhk_idx" ON "ChannelRequest" ("type", "status", "cityId", "intent", "propertyType", "bhkMin", "bhkMax");
CREATE INDEX "ChannelRequest_expiresAt_idx" ON "ChannelRequest" ("expiresAt");
CREATE INDEX "ChannelMatch_status_score_idx" ON "ChannelMatch" ("status", "score");
CREATE INDEX "ChannelMatch_demandRequestId_status_idx" ON "ChannelMatch" ("demandRequestId", "status");
CREATE INDEX "ChannelMatch_supplyRequestId_status_idx" ON "ChannelMatch" ("supplyRequestId", "status");
CREATE INDEX "ChannelDeal_demandOrganizationId_status_idx" ON "ChannelDeal" ("demandOrganizationId", "status");
CREATE INDEX "ChannelDeal_supplyOrganizationId_status_idx" ON "ChannelDeal" ("supplyOrganizationId", "status");
CREATE UNIQUE INDEX "CommissionEntry_organizationId_dealId_entryType_key" ON "CommissionEntry" ("organizationId", "dealId", "entryType");
CREATE INDEX "CommissionEntry_organizationId_entryDate_idx" ON "CommissionEntry" ("organizationId", "entryDate");
CREATE INDEX "CommissionEntry_dealId_idx" ON "CommissionEntry" ("dealId");
CREATE INDEX "ErpnextCloseWrite_status_nextRetryAt_idx" ON "ErpnextCloseWrite" ("status", "nextRetryAt");
CREATE INDEX "ErpnextCloseWrite_channelDealId_idx" ON "ErpnextCloseWrite" ("channelDealId");

-- RLS: private tenant-owned rows fail closed unless the app explicitly sets
-- app.current_org_id for the current transaction/connection.
ALTER TABLE "ChannelRequest" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ChannelRequest" FORCE ROW LEVEL SECURITY;
CREATE POLICY "ChannelRequest_owner_or_open_select" ON "ChannelRequest" FOR SELECT
    USING ("organizationId" = current_setting('app.current_org_id', true) OR "status" = 'OPEN');
CREATE POLICY "ChannelRequest_owner_insert" ON "ChannelRequest" FOR INSERT
    WITH CHECK ("organizationId" = current_setting('app.current_org_id', true));
CREATE POLICY "ChannelRequest_owner_update" ON "ChannelRequest" FOR UPDATE
    USING ("organizationId" = current_setting('app.current_org_id', true))
    WITH CHECK ("organizationId" = current_setting('app.current_org_id', true));
CREATE POLICY "ChannelRequest_owner_delete" ON "ChannelRequest" FOR DELETE
    USING ("organizationId" = current_setting('app.current_org_id', true));

ALTER TABLE "ChannelRequestSource" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ChannelRequestSource" FORCE ROW LEVEL SECURITY;
CREATE POLICY "ChannelRequestSource_org_isolation" ON "ChannelRequestSource"
    USING ("organizationId" = current_setting('app.current_org_id', true))
    WITH CHECK ("organizationId" = current_setting('app.current_org_id', true));

ALTER TABLE "CommissionEntry" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CommissionEntry" FORCE ROW LEVEL SECURITY;
CREATE POLICY "CommissionEntry_org_isolation" ON "CommissionEntry"
    USING ("organizationId" = current_setting('app.current_org_id', true))
    WITH CHECK ("organizationId" = current_setting('app.current_org_id', true));

ALTER TABLE "ErpnextCloseWrite" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ErpnextCloseWrite" FORCE ROW LEVEL SECURITY;
CREATE POLICY "ErpnextCloseWrite_org_isolation" ON "ErpnextCloseWrite"
    USING ("organizationId" = current_setting('app.current_org_id', true))
    WITH CHECK ("organizationId" = current_setting('app.current_org_id', true));

ALTER TABLE "InboundProviderEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "InboundProviderEvent" FORCE ROW LEVEL SECURITY;
CREATE POLICY "InboundProviderEvent_org_isolation" ON "InboundProviderEvent"
    USING ("organizationId" = current_setting('app.current_org_id', true))
    WITH CHECK ("organizationId" = current_setting('app.current_org_id', true));

ALTER TABLE "ChannelNotification" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ChannelNotification" FORCE ROW LEVEL SECURITY;
CREATE POLICY "ChannelNotification_org_isolation" ON "ChannelNotification"
    USING ("organizationId" = current_setting('app.current_org_id', true))
    WITH CHECK ("organizationId" = current_setting('app.current_org_id', true));

-- Matches and deals are visible to either participating organization. Private
-- source references live only on ChannelRequest and are deliberately excluded
-- from this sanitized projection.
ALTER TABLE "ChannelMatch" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ChannelMatch" FORCE ROW LEVEL SECURITY;
CREATE POLICY "ChannelMatch_participant_select" ON "ChannelMatch" FOR SELECT
    USING (
      EXISTS (SELECT 1 FROM "ChannelRequest" r WHERE r."id" IN ("demandRequestId", "supplyRequestId") AND r."organizationId" = current_setting('app.current_org_id', true))
    );
CREATE POLICY "ChannelMatch_participant_insert" ON "ChannelMatch" FOR INSERT
    WITH CHECK (
      EXISTS (SELECT 1 FROM "ChannelRequest" r WHERE r."id" IN ("demandRequestId", "supplyRequestId") AND r."organizationId" = current_setting('app.current_org_id', true))
    );
CREATE POLICY "ChannelMatch_participant_update" ON "ChannelMatch" FOR UPDATE
    USING (
      EXISTS (SELECT 1 FROM "ChannelRequest" r WHERE r."id" IN ("demandRequestId", "supplyRequestId") AND r."organizationId" = current_setting('app.current_org_id', true))
    )
    WITH CHECK (
      EXISTS (SELECT 1 FROM "ChannelRequest" r WHERE r."id" IN ("demandRequestId", "supplyRequestId") AND r."organizationId" = current_setting('app.current_org_id', true))
    );

ALTER TABLE "ChannelDeal" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ChannelDeal" FORCE ROW LEVEL SECURITY;
CREATE POLICY "ChannelDeal_participant_select" ON "ChannelDeal" FOR SELECT
    USING ("demandOrganizationId" = current_setting('app.current_org_id', true) OR "supplyOrganizationId" = current_setting('app.current_org_id', true));
CREATE POLICY "ChannelDeal_participant_insert" ON "ChannelDeal" FOR INSERT
    WITH CHECK ("demandOrganizationId" = current_setting('app.current_org_id', true) OR "supplyOrganizationId" = current_setting('app.current_org_id', true));
CREATE POLICY "ChannelDeal_participant_update" ON "ChannelDeal" FOR UPDATE
    USING ("demandOrganizationId" = current_setting('app.current_org_id', true) OR "supplyOrganizationId" = current_setting('app.current_org_id', true))
    WITH CHECK ("demandOrganizationId" = current_setting('app.current_org_id', true) OR "supplyOrganizationId" = current_setting('app.current_org_id', true));

CREATE VIEW "ChannelRequestSanitized" AS
SELECT
    "id", "organizationId", "type", "cityId", "localitySlug", "intent", "propertyType",
    "bhkMin", "bhkMax", "areaMinSqft", "areaMaxSqft", "budgetMinInr", "budgetMaxInr",
    "priceInr", "detailSummary", "status", "expiresAt", "publishedAt", "closedAt",
    "revision", "createdAt", "updatedAt"
FROM "ChannelRequest";
