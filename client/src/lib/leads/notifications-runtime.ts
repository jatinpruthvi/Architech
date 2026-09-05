import "server-only";

/* Lead-notification runtime: subscribes to the lead event spine, resolves the
   owning organization's active members, and dispatches the transactional
   email. Registered once from instrumentation.ts, gated (see notifications.ts);
   without the gate it logs the silence once, exactly like saved-search alerts.
*/
import { getPrismaClient } from "@/lib/repositories/server/prisma";
import { isPrismaLeadStorage } from "@/lib/leads/source";
import { logger } from "@/lib/observability/logger";
import { onLeadEvent, type LeadEvent } from "./events";
import { buildLeadNotification, leadNotificationGate, leadNotifyTargets, type LeadNotifyGate } from "./notifications";
import { buildBuyerReplyNotification, buyerReplyIdempotencyKey, buyerReplyNotificationGate } from "./buyer-notifications";
import { getLeadForNotification } from "./server";

type MembershipPrismaClient = ReturnType<typeof getPrismaClient> & {
  brokerUser: { findMany(args: unknown): Promise<Array<Record<string, unknown>>> };
};

/** Active memberships of the owning org → the emails that may hear about a
    new lead. Returns [] (loudly) outside prisma mode: demo leads own no
    consented addresses. */
export async function resolveLeadRecipientEmails(organizationId: string | null): Promise<string[]> {
  if (!organizationId || !isPrismaLeadStorage()) return [];
  const prisma = getPrismaClient() as unknown as MembershipPrismaClient;
  const rows = await prisma.brokerUser.findMany({
    where: { organizationId, active: true },
    select: { user: { select: { email: true } } },
  });
  return rows
    .map((row: Record<string, unknown>) => String((row.user as { email?: string } | null)?.email ?? "").trim())
    .filter(Boolean);
}

export async function dispatchLeadEventNotifications(
  gate: Extract<LeadNotifyGate, { enabled: true }>,
  targets: Array<{ email: string; idempotencyKey: string }>,
  content: { subject: string; text: string },
  fetchImpl: typeof fetch = fetch,
): Promise<{ delivered: number; failed: number }> {
  let delivered = 0;
  let failed = 0;
  for (const target of targets) {
    try {
      const response = await fetchImpl("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${gate.apiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": target.idempotencyKey,
        },
        body: JSON.stringify({ from: gate.from, to: target.email, subject: content.subject, text: content.text }),
      });
      if (!response.ok) {
        failed += 1;
        logger.error({ event: "lead.notify_failed", idempotencyKey: target.idempotencyKey, status: response.status }, "lead notification failed");
      } else {
        delivered += 1;
      }
    } catch (error) {
      failed += 1;
      logger.error({ event: "lead.notify_failed", idempotencyKey: target.idempotencyKey, error }, "lead notification transport failed");
    }
  }
  return { delivered, failed };
}

async function onLeadCreated(event: LeadEvent): Promise<void> {
  if (event.type !== "lead.created") return;
  const gate = leadNotificationGate();
  if (!gate.enabled) return;
  const emails = await resolveLeadRecipientEmails(event.organizationId);
  if (emails.length === 0) {
    logger.info({ event: "lead.notify_no_recipients", leadId: event.leadId }, "lead created with no consented recipients (demo or prisma-off mode)");
    return;
  }
  const targets = leadNotifyTargets({ leadId: event.leadId, memberEmails: emails });
  const content = buildLeadNotification({ leadId: event.leadId, listingId: event.listingId, listingTitle: event.listingTitle, baseUrl: gate.baseUrl });
  const result = await dispatchLeadEventNotifications(gate, targets, content);
  logger.info({ event: "lead.notified", leadId: event.leadId, ...result }, "lead notifications dispatched");
}

/** Buyer arm: the enquirer hears when THEIR lead moves. One recipient, the
    email they consented with; a lead without an email is never mailed and
    never guessed at. Tenant of the org's inbox: resolved org-scoped server
    side. */
async function onLeadBuyerEvent(event: LeadEvent): Promise<void> {
  if (event.type !== "lead.acknowledged" && event.type !== "lead.replied") return;
  const gate = buyerReplyNotificationGate();
  if (!gate.enabled) return;
  if (!event.organizationId) return;
  const lead = await getLeadForNotification(event.leadId, event.organizationId);
  /* Soft-deleted/revoked rows must never mail: consent revocation is the
     whole reason they disappear. */
  if (!lead || lead.status === "DELETED") return;
  const email = lead.email?.trim();
  if (!email) {
    logger.info({ event: "buyer.notify_no_email", leadId: event.leadId, type: event.type }, "buyer reply notification skipped — no email was given at enquiry");
    return;
  }
  const firstName = lead.name.trim().split(/\s+/)[0] || "there";
  const content = buildBuyerReplyNotification({ type: event.type, buyerName: firstName, listingTitle: lead.listingTitle || event.listingTitle, listingId: lead.listingId || event.listingId, organizationName: lead.organizationName, baseUrl: gate.baseUrl });
  const result = await dispatchLeadEventNotifications(gate, [{ email, idempotencyKey: buyerReplyIdempotencyKey(event.leadId, event.type, email) }], content);
  logger.info({ event: "buyer.notified", leadId: event.leadId, type: event.type, ...result }, "buyer reply notification dispatched");
}

let registered = false;

/** Subscribe once per process; idempotent. */
export function registerLeadNotificationRuntime(): void {
  if (registered) return;
  registered = true;
  const brokerGate = leadNotificationGate();
  const buyerGate = buyerReplyNotificationGate();
  if (!brokerGate.enabled && !buyerGate.enabled) {
    logger.info({ event: "lead.notify_disabled", missing: { broker: brokerGate.enabled ? [] : brokerGate.missing, buyer: buyerGate.enabled ? [] : buyerGate.missing } }, "lead notifications stay silent until configured");
    return;
  }
  if (!brokerGate.enabled) logger.info({ event: "lead.notify_broker_arm_off", missing: brokerGate.missing }, "broker lead notifications off; buyer arm remains live");
  if (!buyerGate.enabled) logger.info({ event: "lead.notify_buyer_arm_off", missing: buyerGate.missing }, "buyer reply notifications off; broker arm remains live");
  onLeadEvent((event) => {
    /* The spine isolates listeners; we additionally catch so an event never
       surfaced as a rejection from the lead lifecycle the API owns. */
    const cycle = event.type === "lead.created" ? onLeadCreated : onLeadBuyerEvent;
    void cycle(event).catch((error: unknown) => {
      logger.error({ event: "lead.notify_cycle_failed", type: event.type, error }, "lead notification cycle failed");
    });
  });
}
