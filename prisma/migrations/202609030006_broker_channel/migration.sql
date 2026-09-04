-- Broker channel: cross-brokerage demand/supply matching.
--
-- ANCHORED ON LISTINGS.
--
-- A SUPPLY request must reference a real ACTIVE Listing rather than restating
-- price/BHK/area as loose fields. This is enforced by CHECK constraints below,
-- not left to application convention, because a SUPPLY row without a listing
-- would score against nothing and silently produce meaningless matches.
--
-- The payoff: matches score against verified inventory, the counterparty sees
-- the real listing including photos and RERA, there is no parallel description
-- to drift out of sync, and publishing to the channel requires publishing to
-- the public site first -- so the catalogue grows as brokers use the channel.
--
-- DEMAND is deliberately not listing-anchored: a buyer requirement has no
-- listing yet, so it carries structured criteria instead.

CREATE TYPE "ChannelRequestType"   AS ENUM ('DEMAND', 'SUPPLY');
CREATE TYPE "ChannelRequestStatus" AS ENUM ('DRAFT', 'OPEN', 'MATCHED', 'CLOSED', 'CANCELLED', 'EXPIRED');
CREATE TYPE "ChannelMatchStatus"   AS ENUM ('SUGGESTED', 'ACCEPTED', 'REJECTED', 'CONNECTED');
CREATE TYPE "ChannelIntent"        AS ENUM ('BUY', 'RENT');

-- ---------------------------------------------------------------------------
-- ChannelRequest
-- ---------------------------------------------------------------------------
CREATE TABLE "ChannelRequest" (
    "id"              TEXT NOT NULL,
    "organizationId"  TEXT NOT NULL,
    "createdByUserId" TEXT,
    "type"            "ChannelRequestType" NOT NULL,
    "intent"          "ChannelIntent" NOT NULL,
    "status"          "ChannelRequestStatus" NOT NULL DEFAULT 'DRAFT',
    "listingId"       TEXT,
    "cityId"          TEXT NOT NULL,
    "localityId"      TEXT,
    "propertyType"    "PropertyType" NOT NULL,
    "budgetMinInr"    BIGINT,
    "budgetMaxInr"    BIGINT,
    "bhkMin"          INTEGER,
    "bhkMax"          INTEGER,
    "areaMinSqft"     INTEGER,
    "areaMaxSqft"     INTEGER,
    "brokerNote"      VARCHAR(500),
    "expiresAt"       TIMESTAMP(3) NOT NULL,
    "publishedAt"     TIMESTAMP(3),
    "closedAt"        TIMESTAMP(3),
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ChannelRequest_pkey" PRIMARY KEY ("id")
);

-- The core invariant of this design, in the database rather than in a comment.
-- SUPPLY must point at a listing; DEMAND must not.
ALTER TABLE "ChannelRequest" ADD CONSTRAINT "ChannelRequest_supply_requires_listing"
    CHECK (
        ("type" = 'SUPPLY' AND "listingId" IS NOT NULL)
        OR
        ("type" = 'DEMAND' AND "listingId" IS NULL)
    );

-- Budget belongs to DEMAND. On SUPPLY the listing owns the price, and a second
-- copy here could disagree with it.
ALTER TABLE "ChannelRequest" ADD CONSTRAINT "ChannelRequest_budget_is_demand_only"
    CHECK ("type" = 'DEMAND' OR ("budgetMinInr" IS NULL AND "budgetMaxInr" IS NULL));

-- A range that cannot be satisfied is a data-entry error, not a valid filter.
ALTER TABLE "ChannelRequest" ADD CONSTRAINT "ChannelRequest_budget_range_ordered"
    CHECK ("budgetMinInr" IS NULL OR "budgetMaxInr" IS NULL OR "budgetMinInr" <= "budgetMaxInr");
ALTER TABLE "ChannelRequest" ADD CONSTRAINT "ChannelRequest_bhk_range_ordered"
    CHECK ("bhkMin" IS NULL OR "bhkMax" IS NULL OR "bhkMin" <= "bhkMax");
ALTER TABLE "ChannelRequest" ADD CONSTRAINT "ChannelRequest_area_range_ordered"
    CHECK ("areaMinSqft" IS NULL OR "areaMaxSqft" IS NULL OR "areaMinSqft" <= "areaMaxSqft");

ALTER TABLE "ChannelRequest"
    ADD CONSTRAINT "ChannelRequest_organizationId_fkey" FOREIGN KEY ("organizationId")
        REFERENCES "BrokerOrganization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    -- Cascade: if the listing is deleted the supply offer is meaningless.
    ADD CONSTRAINT "ChannelRequest_listingId_fkey" FOREIGN KEY ("listingId")
        REFERENCES "Listing" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "ChannelRequest_cityId_fkey" FOREIGN KEY ("cityId")
        REFERENCES "City" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT "ChannelRequest_localityId_fkey" FOREIGN KEY ("localityId")
        REFERENCES "Locality" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "ChannelRequest_organizationId_status_idx" ON "ChannelRequest" ("organizationId", "status");
-- The matcher's candidate scan.
CREATE INDEX "ChannelRequest_matcher_idx" ON "ChannelRequest" ("status", "type", "intent", "cityId", "propertyType");
CREATE INDEX "ChannelRequest_localityId_status_idx" ON "ChannelRequest" ("localityId", "status");
CREATE INDEX "ChannelRequest_expiresAt_idx" ON "ChannelRequest" ("expiresAt");
CREATE INDEX "ChannelRequest_listingId_idx" ON "ChannelRequest" ("listingId");

-- One OPEN supply offer per listing. Without this a broker can publish the same
-- flat repeatedly and flood every counterparty's match list with duplicates.
CREATE UNIQUE INDEX "ChannelRequest_one_open_supply_per_listing"
    ON "ChannelRequest" ("listingId")
    WHERE "listingId" IS NOT NULL AND "status" IN ('OPEN', 'MATCHED');

-- ---------------------------------------------------------------------------
-- ChannelMatch
-- ---------------------------------------------------------------------------
CREATE TABLE "ChannelMatch" (
    "id"                   TEXT NOT NULL,
    "demandRequestId"      TEXT NOT NULL,
    "supplyRequestId"      TEXT NOT NULL,
    "demandOrganizationId" TEXT NOT NULL,
    "supplyOrganizationId" TEXT NOT NULL,
    "score"                INTEGER NOT NULL,
    "reasons"              JSONB NOT NULL,
    "status"               "ChannelMatchStatus" NOT NULL DEFAULT 'SUGGESTED',
    "demandAcceptedAt"     TIMESTAMP(3),
    "supplyAcceptedAt"     TIMESTAMP(3),
    "rejectedAt"           TIMESTAMP(3),
    "rejectedByOrgId"      TEXT,
    "connectedAt"          TIMESTAMP(3),
    "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"            TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ChannelMatch_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ChannelMatch" ADD CONSTRAINT "ChannelMatch_score_range"
    CHECK ("score" >= 0 AND "score" <= 100);

-- A brokerage matching itself is noise, and would leak nothing but wastes the
-- counterparty slot. Cross-agency is the entire point of the channel.
ALTER TABLE "ChannelMatch" ADD CONSTRAINT "ChannelMatch_distinct_organizations"
    CHECK ("demandOrganizationId" <> "supplyOrganizationId");

ALTER TABLE "ChannelMatch"
    ADD CONSTRAINT "ChannelMatch_demandRequestId_fkey" FOREIGN KEY ("demandRequestId")
        REFERENCES "ChannelRequest" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "ChannelMatch_supplyRequestId_fkey" FOREIGN KEY ("supplyRequestId")
        REFERENCES "ChannelRequest" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Re-running the matcher must update, never duplicate.
CREATE UNIQUE INDEX "ChannelMatch_pair_key" ON "ChannelMatch" ("demandRequestId", "supplyRequestId");
CREATE INDEX "ChannelMatch_demand_inbox_idx" ON "ChannelMatch" ("demandOrganizationId", "status", "score");
CREATE INDEX "ChannelMatch_supply_inbox_idx" ON "ChannelMatch" ("supplyOrganizationId", "status", "score");
CREATE INDEX "ChannelMatch_status_score_idx" ON "ChannelMatch" ("status", "score");

-- ---------------------------------------------------------------------------
-- ChannelNotification -- in-app only, per the v8 decision
-- ---------------------------------------------------------------------------
CREATE TABLE "ChannelNotification" (
    "id"             TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "matchId"        TEXT,
    "kind"           VARCHAR(48) NOT NULL,
    "title"          VARCHAR(160) NOT NULL,
    "body"           VARCHAR(400) NOT NULL,
    "readAt"         TIMESTAMP(3),
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChannelNotification_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ChannelNotification"
    ADD CONSTRAINT "ChannelNotification_organizationId_fkey" FOREIGN KEY ("organizationId")
        REFERENCES "BrokerOrganization" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "ChannelNotification_inbox_idx"
    ON "ChannelNotification" ("organizationId", "readAt", "createdAt");

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------
-- ChannelRequest is NOT tenant-isolated for SELECT, and that is deliberate:
-- discovery requires a brokerage to see other agencies' OPEN requests. What
-- protects privacy here is that a channel request carries no customer
-- identity -- only structured criteria and, for SUPPLY, a listing that is
-- already public. Writes remain owner-only.
ALTER TABLE "ChannelRequest" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ChannelRequest" FORCE ROW LEVEL SECURITY;

-- Read: your own rows in any state, plus other agencies' OPEN/MATCHED rows.
CREATE POLICY "ChannelRequest_discovery_read" ON "ChannelRequest"
    FOR SELECT
    USING (
        "organizationId" = architech_current_org_id()
        OR ("status" IN ('OPEN', 'MATCHED') AND architech_current_org_id() IS NOT NULL)
    );

-- Write: strictly your own.
CREATE POLICY "ChannelRequest_owner_insert" ON "ChannelRequest"
    FOR INSERT WITH CHECK ("organizationId" = architech_current_org_id());
CREATE POLICY "ChannelRequest_owner_update" ON "ChannelRequest"
    FOR UPDATE USING ("organizationId" = architech_current_org_id())
    WITH CHECK ("organizationId" = architech_current_org_id());
CREATE POLICY "ChannelRequest_owner_delete" ON "ChannelRequest"
    FOR DELETE USING ("organizationId" = architech_current_org_id());

-- A match is visible to exactly its two participants.
ALTER TABLE "ChannelMatch" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ChannelMatch" FORCE ROW LEVEL SECURITY;

CREATE POLICY "ChannelMatch_participant_read" ON "ChannelMatch"
    FOR SELECT
    USING (
        "demandOrganizationId" = architech_current_org_id()
        OR "supplyOrganizationId" = architech_current_org_id()
    );

-- Either participant may accept or reject; neither may reassign the match to a
-- different pair, which the WITH CHECK enforces.
CREATE POLICY "ChannelMatch_participant_update" ON "ChannelMatch"
    FOR UPDATE
    USING (
        "demandOrganizationId" = architech_current_org_id()
        OR "supplyOrganizationId" = architech_current_org_id()
    )
    WITH CHECK (
        "demandOrganizationId" = architech_current_org_id()
        OR "supplyOrganizationId" = architech_current_org_id()
    );

-- Matches are created by the matcher on a privileged path, not by tenants.
-- No INSERT or DELETE policy: with FORCE on, both are denied.

ALTER TABLE "ChannelNotification" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ChannelNotification" FORCE ROW LEVEL SECURITY;

CREATE POLICY "ChannelNotification_owner_read" ON "ChannelNotification"
    FOR SELECT USING ("organizationId" = architech_current_org_id());
-- Mark-as-read is the only tenant write.
CREATE POLICY "ChannelNotification_owner_update" ON "ChannelNotification"
    FOR UPDATE USING ("organizationId" = architech_current_org_id())
    WITH CHECK ("organizationId" = architech_current_org_id());
