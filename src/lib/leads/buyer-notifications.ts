import "server-only";

/* Buyer-side reply notifications.
 *
 * The asymmetric half of contact was never fair: a broker knew "new enquiry"
 * within the desk, but a buyer who consented to contact learned nothing when
 * the partner responded — the acknowledgement existed only in the broker's
 * inbox. This closes it, on the same discipline as the broker arm
 * (notifications.ts):
 *
 *  - GATE: BUYER_REPLY_NOTIFICATIONS=on + RESEND_API_KEY + a sender. Silent
 *    and honest when unconfigured: the buyer's expectation was set by the
 *    enquiry form, not by a feature that can't deliver.
 *  - RECIPIENT: the email the buyer gave AT enquiry time, under the consent
 *    text they confirmed then. A lead without an email gets no mail — never
 *    a lookup, never a guess.
 *  - CONTENT: transactional, about THEIR enquiry: listing, partner name, and
 *    what the status change means. No internal pipeline vocabulary, no price
 *    pressure, no listing upsells. Deletion/closure are not buyer-notified
 *    events (see emitStatusEvent in leads/server.ts).
 *  - DELIVERY: Resend REST with Idempotency-Key buyer:{lead}:{type}:{email};
 *    per-recipient (one anyway) fail-soft. If delivery fails the lead's
 *    lifecycle is untouched — notification is a courtesy, not state.
 */

export type BuyerNotifyEnv = Record<string, string | undefined>;

export type BuyerNotifyGate = { enabled: true; from: string; apiKey: string; baseUrl: string } | { enabled: false; missing: string[] };

export function buyerReplyNotificationGate(env: BuyerNotifyEnv = process.env): BuyerNotifyGate {
  const missing: string[] = [];
  if ((env.BUYER_REPLY_NOTIFICATIONS ?? "").trim().toLowerCase() !== "on") missing.push("BUYER_REPLY_NOTIFICATIONS=on");
  if (!env.RESEND_API_KEY) missing.push("RESEND_API_KEY");
  if (!env.BUYER_REPLY_NOTIFICATION_FROM) missing.push("BUYER_REPLY_NOTIFICATION_FROM");
  if (missing.length) return { enabled: false, missing };
  return {
    enabled: true,
    apiKey: env.RESEND_API_KEY as string,
    from: env.BUYER_REPLY_NOTIFICATION_FROM as string,
    baseUrl: (env.NEXT_PUBLIC_SITE_URL ?? "https://www.architech.in").replace(/\/$/, ""),
  };
}

export type BuyerNotifyContent = { subject: string; text: string };

/** The buyer's own understanding of the moment: "acknowledged" means your
    enquiry is being worked on; "replied" means the partner responded. */
export function buildBuyerReplyNotification(args: {
  type: "lead.acknowledged" | "lead.replied";
  buyerName: string;
  listingTitle: string;
  listingId: string;
  organizationName: string;
  baseUrl: string;
}): BuyerNotifyContent {
  const happened = args.type === "lead.acknowledged"
    ? "has acknowledged your enquiry and is working on it."
    : "has replied to your enquiry.";
  return {
    subject: `${args.organizationName} ${args.type === "lead.acknowledged" ? "acknowledged" : "replied to"} your enquiry`,
    text: [
      `Namaste ${args.buyerName},`,
      ``,
      `${args.organizationName} ${happened}`,
      ``,
      `Your enquiry was about: ${args.listingTitle} (${args.listingId}). If the partner needs your details they will use the contact information you shared with consent at the time of the enquiry.`,
      ``,
      `This is a one-time transactional update about your own enquiry — you gave us this email with consent text for exactly this. If your plans have changed, simply let the partner know in your next conversation.`,
      ``,
      `Architech · ${args.baseUrl}`,
    ].join("\n"),
  };
}

export function buyerReplyIdempotencyKey(leadId: string, type: "lead.acknowledged" | "lead.replied", email: string): string {
  return `buyer:${leadId}:${type}:${email}`;
}
