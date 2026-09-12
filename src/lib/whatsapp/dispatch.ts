import "server-only";

import { CONSENT_CLASSES, type ConsentClassId } from "@/lib/interop/lead-ingestion";
import type { PrismaClientLike, PrismaModelDelegate } from "@/lib/repositories/server/prisma";
import {
  WHATSAPP_DISPATCH_PURPOSE,
  type WhatsAppAccountStatus,
  type WhatsAppDispatchStatus,
  type WhatsAppSkipReason,
} from "./contracts";

export type LeadWhatsAppEnqueueInput = {
  leadId: string;
  organizationId: string | null;
  whatsappOptIn: boolean;
  whatsappOptInText: string | null;
  consentClass: string;
  expiresAt: Date;
};

type DispatchClient = PrismaClientLike & {
  marketplaceSubscription: PrismaModelDelegate;
  whatsappAccount: PrismaModelDelegate;
  whatsappTemplate: PrismaModelDelegate;
  whatsappDispatch: PrismaModelDelegate;
};

type SubscriptionRow = { id?: string; status?: string };
type AccountRow = { id?: string; status?: WhatsAppAccountStatus | string };
type TemplateRow = { id?: string; version?: number };

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: unknown }).code === "P2002";
}

function isConsentClass(value: string): value is ConsentClassId {
  return Object.prototype.hasOwnProperty.call(CONSENT_CLASSES, value);
}

function isTemporaryAccountStatus(status: string): boolean {
  return status === "PROVISIONING" || status === "QR_READY" || status === "CONNECTING";
}

function isConnectedAccountStatus(status: string): boolean {
  return status === "CONNECTED";
}

async function createDispatch(
  tx: DispatchClient,
  input: LeadWhatsAppEnqueueInput,
  data: {
    status: WhatsAppDispatchStatus;
    skipReason?: WhatsAppSkipReason;
    accountId?: string | null;
    templateId?: string | null;
    templateVersion?: number | null;
  },
): Promise<void> {
  try {
    await tx.whatsappDispatch.create({
      data: {
        organizationId: input.organizationId,
        leadId: input.leadId,
        accountId: data.accountId ?? null,
        templateId: data.templateId ?? null,
        purpose: WHATSAPP_DISPATCH_PURPOSE,
        templateVersion: data.templateVersion ?? null,
        status: data.status,
        skipReason: data.skipReason ?? null,
        expiresAt: input.expiresAt,
      },
    });
  } catch (error) {
    /* The unique lead/purpose index is the idempotency arbiter. A concurrent
       lead transaction may have won the insert; that is success for this seam.
       Every other database error must abort the lead transaction. */
    if (!isUniqueViolation(error)) throw error;
  }
}

/**
 * Decide whether a newly-created lead can enter the one-shot WhatsApp queue.
 *
 * This function is intentionally provider-free. It receives only the lead
 * transaction, reads organization-scoped eligibility, and writes one durable
 * dispatch row. The worker owns decryption, rendering, and the Evolution call.
 */
export async function enqueueLeadWhatsAppAcknowledgement(
  tx: PrismaClientLike,
  input: LeadWhatsAppEnqueueInput,
): Promise<void> {
  if (!input.organizationId) return;

  const db = tx as DispatchClient;
  const common = { status: "SKIPPED" as const };

  if (input.whatsappOptIn !== true) {
    await createDispatch(db, input, { ...common, skipReason: "NO_WHATSAPP_OPT_IN" });
    return;
  }

  if (!isConsentClass(input.consentClass) || !CONSENT_CLASSES[input.consentClass].automatedWhatsAppFirstTouch) {
    await createDispatch(db, input, { ...common, skipReason: "CONSENT_CLASS_BLOCKED" });
    return;
  }

  const subscription = (await db.marketplaceSubscription.findFirst({
    where: { organizationId: input.organizationId, status: "ACTIVE" },
    orderBy: [{ startsAt: "desc" }, { id: "desc" }],
    select: { id: true, status: true },
  })) as SubscriptionRow | null;
  if (!subscription || subscription.status !== "ACTIVE") {
    await createDispatch(db, input, { ...common, skipReason: "NO_ACTIVE_PLAN" });
    return;
  }

  const template = (await db.whatsappTemplate.findFirst({
    where: { organizationId: input.organizationId, isActive: true },
    orderBy: [{ version: "desc" }, { id: "desc" }],
    select: { id: true, version: true },
  })) as TemplateRow | null;
  if (!template?.id || !Number.isInteger(template.version)) {
    await createDispatch(db, input, { ...common, skipReason: "NO_ACTIVE_TEMPLATE" });
    return;
  }

  const account = (await db.whatsappAccount.findUnique({
    where: { organizationId: input.organizationId },
    select: { id: true, status: true },
  })) as AccountRow | null;
  if (!account?.id || (!isConnectedAccountStatus(String(account.status)) && !isTemporaryAccountStatus(String(account.status)))) {
    await createDispatch(db, input, { ...common, skipReason: "NO_CONNECTED_ACCOUNT" });
    return;
  }

  await createDispatch(db, input, {
    status: "PENDING",
    accountId: account.id,
    templateId: template.id,
    templateVersion: template.version,
  });
}
