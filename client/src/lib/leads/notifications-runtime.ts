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

let registered = false;

/** Subscribe once per process; idempotent. */
export function registerLeadNotificationRuntime(): void {
  if (registered) return;
  registered = true;
  const gate = leadNotificationGate();
  if (!gate.enabled) {
    logger.info({ event: "lead.notify_disabled", missing: gate.missing }, "lead notifications stay silent until configured");
    return;
  }
  onLeadEvent((event) => {
    /* The spine isolates listeners; we additionally catch so an event never
       surfaced as a rejection from lead creation. */
    void onLeadCreated(event).catch((error: unknown) => {
      logger.error({ event: "lead.notify_cycle_failed", error }, "lead notification cycle failed");
    });
  });
}
