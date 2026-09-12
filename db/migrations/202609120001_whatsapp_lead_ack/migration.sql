-- Automatic WhatsApp lead acknowledgement persistence.
--
-- This migration stores only organization-scoped account/template/dispatch
-- metadata. QR payloads, provider credentials, customer phone numbers, and
-- rendered message bodies are intentionally not columns in this schema.

CREATE TYPE "WhatsAppAccountStatus" AS ENUM (
  'PROVISIONING',
  'QR_READY',
  'CONNECTING',
  'CONNECTED',
  'DISCONNECTED',
  'ERROR'
);

CREATE TYPE "WhatsAppDispatchStatus" AS ENUM (
  'PENDING',
  'IN_FLIGHT',
  'ACCEPTED',
  'FAILED',
  'UNKNOWN',
  'SKIPPED'
);

ALTER TABLE "Lead"
  ADD COLUMN "whatsappOptIn" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "whatsappOptInAt" TIMESTAMP(3),
  ADD COLUMN "whatsappOptInText" VARCHAR(240);

CREATE TABLE "WhatsAppAccount" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "provider" VARCHAR(32) NOT NULL DEFAULT 'EVOLUTION_BAILEYS',
  "instanceName" VARCHAR(100) NOT NULL,
  "providerInstanceId" VARCHAR(140),
  "status" "WhatsAppAccountStatus" NOT NULL DEFAULT 'PROVISIONING',
  "phoneLast4" VARCHAR(4),
  "connectedAt" TIMESTAMP(3),
  "lastObservedAt" TIMESTAMP(3),
  "lastErrorCode" VARCHAR(64),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WhatsAppAccount_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WhatsAppTemplate" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "body" VARCHAR(1200) NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WhatsAppTemplate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WhatsAppDispatch" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "leadId" TEXT NOT NULL,
  "accountId" TEXT,
  "templateId" TEXT,
  "purpose" VARCHAR(48) NOT NULL DEFAULT 'lead-ack',
  "templateVersion" INTEGER,
  "status" "WhatsAppDispatchStatus" NOT NULL DEFAULT 'PENDING',
  "skipReason" VARCHAR(64),
  "providerMessageId" VARCHAR(140),
  "payloadHash" VARCHAR(64),
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "lastErrorCode" VARCHAR(64),
  "nextAttemptAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "acceptedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WhatsAppDispatch_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WhatsAppAccount_organizationId_key" ON "WhatsAppAccount"("organizationId");
CREATE UNIQUE INDEX "WhatsAppAccount_instanceName_key" ON "WhatsAppAccount"("instanceName");
CREATE UNIQUE INDEX "WhatsAppTemplate_organizationId_version_key" ON "WhatsAppTemplate"("organizationId", "version");
CREATE UNIQUE INDEX "WhatsAppDispatch_leadId_purpose_key" ON "WhatsAppDispatch"("leadId", "purpose");

CREATE INDEX "WhatsAppAccount_organizationId_status_idx" ON "WhatsAppAccount"("organizationId", "status");
CREATE INDEX "WhatsAppAccount_status_lastObservedAt_idx" ON "WhatsAppAccount"("status", "lastObservedAt");
CREATE INDEX "WhatsAppTemplate_organizationId_isActive_version_idx" ON "WhatsAppTemplate"("organizationId", "isActive", "version");
CREATE INDEX "WhatsAppDispatch_organizationId_status_nextAttemptAt_idx" ON "WhatsAppDispatch"("organizationId", "status", "nextAttemptAt");
CREATE INDEX "WhatsAppDispatch_accountId_status_idx" ON "WhatsAppDispatch"("accountId", "status");
CREATE INDEX "WhatsAppDispatch_providerMessageId_idx" ON "WhatsAppDispatch"("providerMessageId");

ALTER TABLE "WhatsAppAccount"
  ADD CONSTRAINT "WhatsAppAccount_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "BrokerOrganization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WhatsAppTemplate"
  ADD CONSTRAINT "WhatsAppTemplate_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "BrokerOrganization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WhatsAppDispatch"
  ADD CONSTRAINT "WhatsAppDispatch_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "BrokerOrganization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "WhatsAppDispatch_leadId_fkey"
  FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "WhatsAppDispatch_accountId_fkey"
  FOREIGN KEY ("accountId") REFERENCES "WhatsAppAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "WhatsAppDispatch_templateId_fkey"
  FOREIGN KEY ("templateId") REFERENCES "WhatsAppTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
