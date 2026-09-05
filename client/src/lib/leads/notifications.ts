import "server-only";

/* Lead-created notifications.
 *
 * The audit trail named it plainly: contact/inquiry is "strong; notification
 * delivery remains a gate". This closes the code half, on the same discipline
 * as saved-search alerts (lib/saved-search/alerts.ts):
 *
 *  - GATE: `LEAD_NOTIFICATIONS=on` + `RESEND_API_KEY` + `LEAD_NOTIFICATION_FROM`.
 *    Anything missing → nothing registered, one log line, no silent pretend.
 *    LEG-005 owns activation of the copy.
 *  - PII: the buyer's name, phone, email and message NEVER leave the request
 *    that created the lead. The email carries the listing identity and a link
 *    back to the masked inbox only — a notification must not become a second
 *    PII channel while LEG-002/LEG-005 are still open.
 *  - RECIPIENTS: active BrokerUser memberships of the owning organization,
 *    resolved in prisma mode only. Demo/in-memory leads own no consented
 *    address — demo-org inboxes log "no recipients", never mail a fixture.
 *  - DELIVERY: Resend REST, Idempotency-Key `lead:{leadId}:{leadRecipient email}`
 *    so a redelivered event cannot double-mail; per-recipient fail-soft, the
 *    lead write itself has already committed.
 */

export type LeadNotifyEnv = Record<string, string | undefined>;

export type LeadNotifyGate = { enabled: true; from: string; apiKey: string; baseUrl: string } | { enabled: false; missing: string[] };

export function leadNotificationGate(env: LeadNotifyEnv = process.env): LeadNotifyGate {
  const missing: string[] = [];
  if ((env.LEAD_NOTIFICATIONS ?? "").trim().toLowerCase() !== "on") missing.push("LEAD_NOTIFICATIONS=on");
  if (!env.RESEND_API_KEY) missing.push("RESEND_API_KEY");
  if (!env.LEAD_NOTIFICATION_FROM) missing.push("LEAD_NOTIFICATION_FROM");
  if (missing.length) return { enabled: false, missing };
  return {
    enabled: true,
    apiKey: env.RESEND_API_KEY as string,
    from: env.LEAD_NOTIFICATION_FROM as string,
    baseUrl: (env.NEXT_PUBLIC_SITE_URL ?? "https://www.architech.in").replace(/\/$/, ""),
  };
}

export type LeadNotifyContent = { subject: string; text: string };

/** PII-free by construction: every field in here is one a stranger could hold
    without learning anything about the buyer. */
export function buildLeadNotification(args: { leadId: string; listingId: string; listingTitle: string; baseUrl: string }): LeadNotifyContent {
  return {
    subject: `New enquiry on your listing: ${args.listingTitle}`,
    text: [
      "A new enquiry has arrived in your Architech inbox.",
      ``,
      `Listing: ${args.listingTitle} (${args.listingId})`,
      `Lead reference: ${args.leadId}`,
      ``,
      `The buyer's details stay masked in the desk until you act on them: ${args.baseUrl}/broker/dashboard/?section=inquiry`,
      ``,
      "You are receiving this because this listing carries your organization in Architech and lead notifications are on.",
    ].join("\n"),
  };
}

export type LeadNotifyTarget = { email: string; idempotencyKey: string };

export function leadNotifyTargets(args: { leadId: string; memberEmails: string[] }): LeadNotifyTarget[] {
  const seen = new Set<string>();
  const targets: LeadNotifyTarget[] = [];
  for (const raw of args.memberEmails) {
    const email = raw.trim();
    if (!email || seen.has(email)) continue;
    seen.add(email);
    targets.push({ email, idempotencyKey: `lead:${args.leadId}:${email}` });
  }
  return targets;
}
