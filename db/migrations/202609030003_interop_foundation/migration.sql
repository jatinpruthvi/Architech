-- Interop foundation: make Architech data consumable by Frappe CRM / ERPNext.
--
-- Verified against pinned upstream source:
--   frappe/frappe   v16.33.0 (33bf510)
--   frappe/crm      v1.83.0  (52c500d)
--   frappe/erpnext  v16.34.1 (0b50853)
--
-- Nothing here couples us to Frappe. These are plain columns and a plain
-- outbox; they make the eventual projection correct, and they are inert until
-- the broker channel uses them. See
-- docs/broker-suite/erpnext-consumability-schema-constraints.md.

-- ---------------------------------------------------------------------------
-- 1. Broker organization: business contact + external keys
-- ---------------------------------------------------------------------------
-- The agency switchboard number, revealed to a counterparty brokerage on an
-- accepted channel match. Stored in E.164 because ERPNext resolves contacts by
-- EXACT STRING MATCH on the phone column (erpnext/crm/frappe_crm_api.py:115:
-- frappe.db.exists("Contact Phone", {"phone": mobile_no})). There is no
-- normalisation on the receiving side, so "+91 98765 43210" and "9876543210"
-- would become two contacts for one firm.
--
-- varchar(20) is deliberate: E.164 caps at 15 digits plus '+', so 20 leaves
-- headroom while still rejecting free text.
ALTER TABLE "BrokerOrganization"
    ADD COLUMN "businessPhoneE164" VARCHAR(20),
    ADD COLUMN "businessPhoneVerifiedAt" TIMESTAMP(3),
    -- Foreign keys into the brokerage's OWN Frappe/ERPNext site. varchar(140)
    -- is Frappe's universal Data/Link width (frappe/database/database.py:91:
    -- VARCHAR_LEN = 140). We only ever store values a site handed us.
    ADD COLUMN "erpnextCustomerId" VARCHAR(140),
    ADD COLUMN "frappeCrmOrgId" VARCHAR(140);

-- Reverse lookup for an inbound webhook that carries only the remote key.
CREATE INDEX "BrokerOrganization_erpnextCustomerId_idx"
    ON "BrokerOrganization" ("erpnextCustomerId");

-- ---------------------------------------------------------------------------
-- 2. Lead: link to the CRM Lead it becomes
-- ---------------------------------------------------------------------------
-- Mirrors upstream's own convention for external identifiers -- Frappe CRM
-- stores facebook_lead_id as a unique Data column and lets the database reject
-- re-imports (crm/fcrm/doctype/crm_lead/crm_lead.json).
ALTER TABLE "Lead"
    ADD COLUMN "frappeCrmLeadId" VARCHAR(140),
    ADD COLUMN "frappeSyncedAt" TIMESTAMP(3);

-- Scoped, NOT global. Two brokerages run separate Frappe sites whose primary
-- keys collide freely -- both will have a "CRM-LEAD-2026-00001". A global
-- unique index here would reject the second brokerage's perfectly valid lead.
--
-- In PostgreSQL, NULLs are distinct in a unique index, so the many rows that
-- have not been projected yet do not conflict with each other.
CREATE UNIQUE INDEX "Lead_organizationId_frappeCrmLeadId_key"
    ON "Lead" ("organizationId", "frappeCrmLeadId");

-- ---------------------------------------------------------------------------
-- 3. Outbound projection queue
-- ---------------------------------------------------------------------------
CREATE TYPE "InteropSyncStatus" AS ENUM (
    'PENDING',
    'IN_FLIGHT',
    'SUCCESS',
    'FAILED',
    -- Document existed and was then cancelled upstream (Frappe docstatus 2).
    -- ERPNext's Journal Entry and Sales Invoice are submittable, and a
    -- cancelled document still exists holding its unique values. Without this
    -- state a naive "key exists -> success" check reports a reversed
    -- commission as delivered.
    'CANCELLED_UPSTREAM',
    'RECONCILED'
);

CREATE TABLE "InteropOutbox" (
    "id"              TEXT NOT NULL,
    "organizationId"  TEXT NOT NULL,
    "eventType"       VARCHAR(64) NOT NULL,
    "entityType"      VARCHAR(64) NOT NULL,
    "entityId"        TEXT NOT NULL,
    -- 128 < Frappe's 140, so a key cannot truncate on the receiving side and
    -- collide two distinct deals onto one document.
    "idempotencyKey"  VARCHAR(128) NOT NULL,
    "payloadHash"     VARCHAR(64) NOT NULL,
    "payload"         JSONB NOT NULL,
    "status"          "InteropSyncStatus" NOT NULL DEFAULT 'PENDING',
    "attemptCount"    INTEGER NOT NULL DEFAULT 0,
    "lastError"       TEXT,
    "nextRetryAt"     TIMESTAMP(3),
    "remoteDocId"     VARCHAR(140),
    -- Frappe docstatus: 0 draft, 1 submitted, 2 cancelled.
    "remoteDocstatus" INTEGER,
    "processedAt"     TIMESTAMP(3),
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL,
    CONSTRAINT "InteropOutbox_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InteropOutbox_idempotencyKey_key"
    ON "InteropOutbox" ("idempotencyKey");
-- The worker's claim query: due work, oldest first.
CREATE INDEX "InteropOutbox_status_nextRetryAt_idx"
    ON "InteropOutbox" ("status", "nextRetryAt");
CREATE INDEX "InteropOutbox_organizationId_eventType_status_idx"
    ON "InteropOutbox" ("organizationId", "eventType", "status");
CREATE INDEX "InteropOutbox_entityType_entityId_idx"
    ON "InteropOutbox" ("entityType", "entityId");

-- Cascade: an outbox row is meaningless without its tenant, and a deleted
-- organization must not leave undeliverable work behind.
ALTER TABLE "InteropOutbox"
    ADD CONSTRAINT "InteropOutbox_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "BrokerOrganization" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- 4. Inbound de-duplication
-- ---------------------------------------------------------------------------
CREATE TABLE "InteropInboundEvent" (
    "id"             TEXT NOT NULL,
    "provider"       VARCHAR(32) NOT NULL,
    "externalId"     VARCHAR(140) NOT NULL,
    "organizationId" TEXT,
    "eventType"      VARCHAR(64),
    "processedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InteropInboundEvent_pkey" PRIMARY KEY ("id")
);

-- The de-duplication guarantee itself: a replayed webhook violates this and is
-- discarded rather than reprocessed.
CREATE UNIQUE INDEX "InteropInboundEvent_provider_externalId_key"
    ON "InteropInboundEvent" ("provider", "externalId");
CREATE INDEX "InteropInboundEvent_organizationId_processedAt_idx"
    ON "InteropInboundEvent" ("organizationId", "processedAt");
