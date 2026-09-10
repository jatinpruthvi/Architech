ALTER TABLE "Lead"
  ADD COLUMN IF NOT EXISTS "stage" VARCHAR(32) NOT NULL DEFAULT 'NEW',
  ADD COLUMN IF NOT EXISTS "phoneCiphertext" BYTEA,
  ADD COLUMN IF NOT EXISTS "phoneLast4" VARCHAR(4),
  ADD COLUMN IF NOT EXISTS "consentClass" VARCHAR(32),
  ADD COLUMN IF NOT EXISTS "consentedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "retentionUntil" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "callSuppressedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "callAttempts" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "LeadCallLog" (
  "id" TEXT NOT NULL,
  "leadId" TEXT NOT NULL,
  "actorUserId" TEXT,
  "organizationId" TEXT,
  "outcome" VARCHAR(32) NOT NULL,
  "note" VARCHAR(500),
  "lostReason" VARCHAR(500),
  "stageBefore" VARCHAR(32) NOT NULL,
  "stageAfter" VARCHAR(32) NOT NULL,
  "nextActionAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LeadCallLog_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "LeadCallLog_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "LeadCallLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "BrokerOrganization"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "LeadCallLog_leadId_createdAt_idx" ON "LeadCallLog"("leadId", "createdAt");
CREATE INDEX IF NOT EXISTS "LeadCallLog_organizationId_nextActionAt_idx"
  ON "LeadCallLog" ("organizationId", "nextActionAt");

CREATE INDEX IF NOT EXISTS "Lead_retentionUntil_deletedAt_idx"
  ON "Lead" ("retentionUntil", "deletedAt");
