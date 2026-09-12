import "server-only";

import { decryptContact } from "@/lib/interop/contact-crypto";
import { normalizeIndianPhone } from "@/lib/interop/phone";
import { consentPermissionsFor, type ConsentClassId } from "@/lib/interop/lead-ingestion";
import { payloadHash } from "@/lib/interop/idempotency";
import { isPrismaLeadStorage } from "@/lib/leads/source";
import { getPrismaClient, type PrismaClientLike, type PrismaModelDelegate } from "@/lib/repositories/server/prisma";
import { withTenantPrisma, type PrismaTenantClient } from "@/lib/repositories/server/tenant";
import { resolveWhatsAppPlanGate } from "./access";
import {
  WHATSAPP_DISPATCH_PURPOSE,
  WHATSAPP_IN_FLIGHT_STALE_MS,
  WHATSAPP_DISPATCH_TTL_MS,
  type WhatsAppBatchResult,
  type WhatsAppDispatchStatus,
  type WhatsAppSkipReason,
} from "./contracts";
import { getEvolutionProvider } from "./evolution";
import { renderAcknowledgementTemplate } from "./template";
import { WhatsAppProviderError } from "./provider";

const DEFAULT_BATCH_LIMIT = 25;
const TEMPORARY_RETRY_MS = 5_000;

type WorkerClient = PrismaClientLike & {
  whatsappDispatch: PrismaModelDelegate;
  whatsappAccount: PrismaModelDelegate;
  whatsappTemplate: PrismaModelDelegate;
  marketplaceSubscription: PrismaModelDelegate;
  auditEvent: PrismaModelDelegate;
  brokerOrganization: PrismaClientLike["brokerOrganization"];
};

type DispatchRow = {
  id: string;
  organizationId: string;
  leadId: string;
  accountId?: string | null;
  templateId?: string | null;
  templateVersion?: number | null;
  status: string;
  attemptCount: number;
  expiresAt?: unknown;
  updatedAt?: unknown;
  lead?: {
    id: string;
    organizationId?: string | null;
    deletedAt?: unknown;
    retentionUntil?: unknown;
    whatsappOptIn?: boolean;
    whatsappOptInText?: string | null;
    consentClass?: string | null;
    phoneCiphertext?: Uint8Array | null;
    name?: string | null;
    listing?: { title?: string | null; city?: { name?: string | null } | null } | null;
  } | null;
  account?: { id: string; organizationId?: string | null; instanceName: string; status: string } | null;
  template?: { id: string; organizationId?: string | null; version: number; body: string } | null;
  organization?: { id: string; name?: string | null } | null;
};

function emptyBatch(): WhatsAppBatchResult {
  return { scanned: 0, claimed: 0, accepted: 0, failed: 0, unknown: 0, skipped: 0, pending: 0 };
}

function dbClient(): PrismaTenantClient {
  return getPrismaClient() as unknown as PrismaTenantClient;
}

async function withOrganization<T>(organizationId: string, work: (tx: WorkerClient) => Promise<T>): Promise<T> {
  return withTenantPrisma(dbClient(), organizationId, (tx) => work(tx as WorkerClient));
}

function asTime(value: unknown): number | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.getTime();
}

function boundedDisplay(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const clean = [...value]
    .map((character) => {
      const code = character.charCodeAt(0);
      return code <= 0x1f || code === 0x7f ? " " : character;
    })
    .join("")
    .replace(/\s+/g, " ")
    .trim();
  return clean.slice(0, 240) || fallback;
}

function skipReasonForGate(gate: { reason: string }): WhatsAppSkipReason {
  return gate.reason === "NO_ACTIVE_PLAN" ? "NO_ACTIVE_PLAN" : "PROVIDER_DISABLED";
}

async function addAudit(tx: WorkerClient, organizationId: string, dispatchId: string, action: string, status: WhatsAppDispatchStatus, attemptCount: number, code?: string): Promise<void> {
  await tx.auditEvent.create({
    data: {
      organizationId,
      action,
      entityType: "WhatsAppDispatch",
      entityId: dispatchId,
      metadata: { purpose: WHATSAPP_DISPATCH_PURPOSE, status, attemptCount, ...(code ? { code } : {}) },
    },
  });
}

async function transition(
  organizationId: string,
  dispatchId: string,
  from: string,
  status: WhatsAppDispatchStatus,
  attemptCount: number,
  data: Record<string, unknown> = {},
  code?: string,
): Promise<boolean> {
  return withOrganization(organizationId, async (tx) => {
    const updated = await tx.whatsappDispatch.updateMany({
      where: { id: dispatchId, organizationId, status: from },
      data: { status, ...data },
    });
    if (updated.count !== 1) return false;
    await addAudit(tx, organizationId, dispatchId, `whatsapp.dispatch.${status.toLowerCase()}`, status, attemptCount, code);
    return true;
  });
}

async function markSkipped(row: DispatchRow, reason: WhatsAppSkipReason): Promise<boolean> {
  return transition(row.organizationId, row.id, "IN_FLIGHT", "SKIPPED", row.attemptCount, { skipReason: reason, completedAt: new Date() }, reason);
}

async function recoverAmbiguousInFlight(organizationId: string, now: Date): Promise<number> {
  let recovered = 0;
  const cutoff = new Date(now.getTime() - WHATSAPP_IN_FLIGHT_STALE_MS);
  await withOrganization(organizationId, async (tx) => {
    const stale = (await tx.whatsappDispatch.findMany({
      where: { organizationId, status: "IN_FLIGHT", updatedAt: { lt: cutoff } },
      select: { id: true, attemptCount: true },
      take: DEFAULT_BATCH_LIMIT * 4,
    })) as Array<{ id: string; attemptCount: number }>;
    for (const row of stale) {
      const updated = await tx.whatsappDispatch.updateMany({
        where: { id: row.id, organizationId, status: "IN_FLIGHT" },
        data: { status: "UNKNOWN", lastErrorCode: "WORKER_CRASH_AMBIGUOUS", completedAt: now },
      });
      if (updated.count === 1) {
        recovered += 1;
        await addAudit(tx, organizationId, row.id, "whatsapp.dispatch.unknown", "UNKNOWN", row.attemptCount, "WORKER_CRASH_AMBIGUOUS");
      }
    }
  });
  return recovered;
}

async function claim(organizationId: string, id: string, now: Date): Promise<boolean> {
  return withOrganization(organizationId, async (tx) => {
    const result = await tx.whatsappDispatch.updateMany({
      where: {
        id,
        organizationId,
        status: "PENDING",
        OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
        lead: { is: { organizationId, deletedAt: null, retentionUntil: { gt: now } } },
      },
      data: { status: "IN_FLIGHT", attemptCount: { increment: 1 } },
    });
    return result.count === 1;
  });
}

async function loadDispatch(organizationId: string, id: string): Promise<DispatchRow | null> {
  return withOrganization(organizationId, async (tx) => {
    const row = await tx.whatsappDispatch.findUnique({
      where: { id },
      include: {
        lead: { include: { listing: { include: { city: true } } } },
        account: true,
        template: true,
        organization: true,
      },
    });
    if (!row || typeof row !== "object") return null;
    const typed = row as DispatchRow;
    return typed.organizationId === organizationId ? typed : null;
  });
}

async function markExpiredPending(organizationId: string, row: { id: string; attemptCount?: number }): Promise<boolean> {
  return withOrganization(organizationId, async (tx) => {
    const updated = await tx.whatsappDispatch.updateMany({
      where: { id: row.id, organizationId, status: "PENDING" },
      data: { status: "SKIPPED", skipReason: "LEAD_EXPIRED", completedAt: new Date() },
    });
    if (updated.count !== 1) return false;
    await addAudit(tx, organizationId, row.id, "whatsapp.dispatch.skipped", "SKIPPED", row.attemptCount ?? 0, "LEAD_EXPIRED");
    return true;
  });
}

async function processClaimedRow(row: DispatchRow, now: Date): Promise<keyof Pick<WhatsAppBatchResult, "accepted" | "failed" | "unknown" | "skipped" | "pending">> {
  if (asTime(row.expiresAt) !== null && (asTime(row.expiresAt) as number) <= now.getTime()) {
    await markSkipped(row, "LEAD_EXPIRED");
    return "skipped";
  }
  if (!row.lead || row.lead.organizationId !== row.organizationId) {
    await markSkipped(row, "LEAD_DELETED");
    return "skipped";
  }
  if (row.lead.deletedAt || (asTime(row.lead.retentionUntil) !== null && (asTime(row.lead.retentionUntil) as number) <= now.getTime())) {
    await markSkipped(row, asTime(row.lead.retentionUntil) !== null && (asTime(row.lead.retentionUntil) as number) <= now.getTime() ? "LEAD_EXPIRED" : "LEAD_DELETED");
    return "skipped";
  }
  if (row.lead.whatsappOptIn !== true || typeof row.lead.whatsappOptInText !== "string" || row.lead.whatsappOptInText.trim().length < 12) {
    await markSkipped(row, "NO_WHATSAPP_OPT_IN");
    return "skipped";
  }
  const consentClass = row.lead.consentClass as ConsentClassId;
  try {
    if (!consentPermissionsFor(consentClass).automatedWhatsAppFirstTouch) {
      await markSkipped(row, "CONSENT_CLASS_BLOCKED");
      return "skipped";
    }
  } catch {
    await markSkipped(row, "CONSENT_CLASS_BLOCKED");
    return "skipped";
  }

  const gate = await resolveWhatsAppPlanGate(row.organizationId);
  if (!gate.ok) {
    await markSkipped(row, skipReasonForGate(gate));
    return "skipped";
  }
  if (!row.account || row.account.organizationId !== row.organizationId) {
    await markSkipped(row, "NO_CONNECTED_ACCOUNT");
    return "skipped";
  }
  if (["PROVISIONING", "QR_READY", "CONNECTING"].includes(row.account.status)) {
    await transition(row.organizationId, row.id, "IN_FLIGHT", "PENDING", row.attemptCount, { nextAttemptAt: new Date(now.getTime() + TEMPORARY_RETRY_MS) });
    return "pending";
  }
  if (row.account.status !== "CONNECTED") {
    await markSkipped(row, "NO_CONNECTED_ACCOUNT");
    return "skipped";
  }
  if (!row.template || row.template.organizationId !== row.organizationId || row.template.id !== row.templateId || row.template.version !== row.templateVersion) {
    await markSkipped(row, "TEMPLATE_VERSION_MISSING");
    return "skipped";
  }
  if (!row.lead.phoneCiphertext || !row.lead.listing?.title || !row.lead.listing.city?.name || !row.organization?.name) {
    await markSkipped(row, "INVALID_PHONE");
    return "skipped";
  }

  let normalized;
  let text: string;
  let hash: string;
  try {
    const decrypted = decryptContact(row.lead.phoneCiphertext);
    normalized = normalizeIndianPhone(decrypted);
    if (!normalized.ok) {
      await markSkipped(row, "INVALID_PHONE");
      return "skipped";
    }
    text = renderAcknowledgementTemplate(row.template.body, {
      firstName: boundedDisplay(row.lead.name, "there").split(" ")[0] || "there",
      brokerName: boundedDisplay(row.organization.name, "our team"),
      listingTitle: boundedDisplay(row.lead.listing.title, "this listing"),
      city: boundedDisplay(row.lead.listing.city.name, "your city"),
    });
    hash = payloadHash({ purpose: WHATSAPP_DISPATCH_PURPOSE, templateVersion: row.template.version, number: normalized.e164, text });
  } catch (error) {
    const code = error instanceof WhatsAppProviderError ? error.code : "TEMPLATE_INVALID";
    await transition(row.organizationId, row.id, "IN_FLIGHT", "FAILED", row.attemptCount, { lastErrorCode: code, completedAt: new Date() }, code);
    return "failed";
  }

  try {
    const result = await getEvolutionProvider().sendText({ instanceName: row.account.instanceName, number: normalized.e164.replace(/\D/g, ""), text });
    if (!result.providerMessageId) {
      await transition(row.organizationId, row.id, "IN_FLIGHT", "UNKNOWN", row.attemptCount, { payloadHash: hash, lastErrorCode: "PROVIDER_NO_MESSAGE_ID", completedAt: new Date() }, "PROVIDER_NO_MESSAGE_ID");
      return "unknown";
    }
    await transition(row.organizationId, row.id, "IN_FLIGHT", "ACCEPTED", row.attemptCount, { payloadHash: hash, providerMessageId: result.providerMessageId, acceptedAt: new Date(), completedAt: new Date() });
    return "accepted";
  } catch (error) {
    const ambiguous = error instanceof WhatsAppProviderError && error.kind === "AMBIGUOUS";
    const code = error instanceof WhatsAppProviderError ? error.code : "PROVIDER_UNAVAILABLE";
    const status: "UNKNOWN" | "FAILED" = ambiguous ? "UNKNOWN" : "FAILED";
    await transition(row.organizationId, row.id, "IN_FLIGHT", status, row.attemptCount, { payloadHash: hash, lastErrorCode: code, completedAt: new Date() }, code);
    return status === "UNKNOWN" ? "unknown" : "failed";
  }
}

export async function processWhatsAppDispatchBatch(input: { organizationId: string; limit?: number; now?: Date }): Promise<WhatsAppBatchResult> {
  const result = emptyBatch();
  const now = input.now ?? new Date();
  const limit = Math.max(1, Math.min(input.limit ?? DEFAULT_BATCH_LIMIT, 100));
  if (!isPrismaLeadStorage()) return result;
  result.unknown += await recoverAmbiguousInFlight(input.organizationId, now);
  const pending = await withOrganization(input.organizationId, async (tx) => {
    return (await tx.whatsappDispatch.findMany({
      where: { organizationId: input.organizationId, status: "PENDING", OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }] },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: limit,
      select: { id: true, attemptCount: true, expiresAt: true },
    })) as Array<{ id: string; attemptCount: number; expiresAt?: unknown }>;
  });
  result.scanned = pending.length;
  for (const candidate of pending) {
    if (asTime(candidate.expiresAt) !== null && (asTime(candidate.expiresAt) as number) <= now.getTime()) {
      if (await markExpiredPending(input.organizationId, candidate)) result.skipped += 1;
      continue;
    }
    if (!(await claim(input.organizationId, candidate.id, now))) continue;
    result.claimed += 1;
    const row = await loadDispatch(input.organizationId, candidate.id);
    if (!row) {
      const recovered = await transition(input.organizationId, candidate.id, "IN_FLIGHT", "UNKNOWN", candidate.attemptCount + 1, { lastErrorCode: "WORKER_ROW_MISSING", completedAt: new Date() }, "WORKER_ROW_MISSING");
      if (recovered) result.unknown += 1;
      continue;
    }
    const counter = await processClaimedRow(row, now);
    result[counter] += 1;
  }
  return result;
}

export async function processWhatsAppOutbox(input: { limit?: number; now?: Date } = {}): Promise<WhatsAppBatchResult> {
  const result = emptyBatch();
  if (!isPrismaLeadStorage()) return result;
  const rows = (await getPrismaClient().brokerOrganization.findMany({ select: { id: true }, orderBy: { id: "asc" }, take: 1000 })) as Array<{ id?: string }>;
  let remaining = Math.max(1, Math.min(input.limit ?? DEFAULT_BATCH_LIMIT, 100));
  for (const row of rows) {
    if (!row.id || remaining <= 0) break;
    const batch = await processWhatsAppDispatchBatch({ organizationId: row.id, limit: remaining, now: input.now });
    for (const key of Object.keys(result) as Array<keyof WhatsAppBatchResult>) result[key] += batch[key];
    remaining -= batch.scanned;
  }
  return result;
}

export async function markWhatsAppDispatchFromProvider(input: { organizationId: string; accountId: string; providerMessageId: string; state: "ACCEPTED" | "FAILED" }): Promise<void> {
  if (!input.providerMessageId || !isPrismaLeadStorage()) return;
  await withOrganization(input.organizationId, async (tx) => {
    const account = (await tx.whatsappAccount.findUnique({ where: { id: input.accountId }, select: { id: true, organizationId: true } })) as { id: string; organizationId?: string | null } | null;
    if (!account || account.organizationId !== input.organizationId) return;
    const dispatch = (await tx.whatsappDispatch.findFirst({ where: { organizationId: input.organizationId, accountId: input.accountId, providerMessageId: input.providerMessageId } })) as { id: string; attemptCount: number; status: string } | null;
    if (!dispatch || !["IN_FLIGHT", "ACCEPTED"].includes(dispatch.status)) return;
    const now = new Date();
    const status = input.state;
    const updated = await tx.whatsappDispatch.updateMany({
      where: { id: dispatch.id, organizationId: input.organizationId, status: { in: ["IN_FLIGHT", "ACCEPTED"] } },
      data: { status, ...(status === "ACCEPTED" ? { acceptedAt: now } : { lastErrorCode: "PROVIDER_FAILED" }), completedAt: now },
    });
    if (updated.count === 1) await addAudit(tx, input.organizationId, dispatch.id, `whatsapp.dispatch.${status.toLowerCase()}`, status, dispatch.attemptCount, status === "FAILED" ? "PROVIDER_FAILED" : undefined);
  });
}

export { WHATSAPP_DISPATCH_TTL_MS };
