/* Lead lifecycle events.
 *
 * The smallest spine that is honest: `lead.created` is the only event because
 * it is the only lifecycle moment the notification pipeline owns. Same
 * subscriber-isolation rule as the listing spine (`lib/listing/events.ts`) —
 * a throwing listener must never break lead creation for the buyer.
 */
export type LeadEvent = {
  type: "lead.created" | "lead.acknowledged" | "lead.replied";
  leadId: string;
  /** The organization that owns the inbox this lead landed in, when known.
      Null means an unattributed fixture lead; nobody should be mailed. */
  organizationId: string | null;
  listingId: string;
  listingTitle: string;
  createdAt: string;
};

type LeadEventListener = (event: LeadEvent) => void | Promise<void>;

const listeners = new Set<LeadEventListener>();

export function onLeadEvent(listener: LeadEventListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Fire-and-isolate: emit synchronously to every listener, trapping each
    one's errors so one bad subscriber cannot mask another or bubble into
    the API response the buyer is waiting on. */
export function emitLeadEvent(event: LeadEvent): void {
  for (const listener of [...listeners]) {
    try {
      void listener(event);
    } catch (error) {
      console.error("[leads/events] listener failed", event.type, error);
    }
  }
}

/** Test harness: drop every subscription. */
export function resetLeadEventListenersForTests(): void {
  listeners.clear();
}
