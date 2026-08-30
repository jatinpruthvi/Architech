/* The event spine.

   One choke point. Nothing moves a listing's lifecycle without passing
   through `emitListingEvent`, because every other subsystem in the SEO
   operating system hangs off it: revalidation, sitemap inclusion, indexing
   requests, authority routing, and measurement all need to know that a
   listing changed state, and none of them should have to be remembered at
   each call site. That is what a choke point buys — you cannot forget to
   notify a system that subscribes.

   The discipline this file exists to enforce is the reverse of the usual one.
   Normally you add a call site and hope someone remembered the side effects.
   Here, adding a write path that publishes without emitting is the bug, and
   the test in events.test.ts that asserts moderation emits `listing.published`
   is what catches it.

   Deliberately dependency-free. This module is imported by the persistence
   layer, so anything it pulls in becomes a dependency of every write. It
   imports types, nothing else. */
import type { DraftStatus } from "@/lib/broker/workflow";

/* Wider than `DraftStatus`. A draft is a broker-workflow object; a listing's
   lifecycle includes states the workflow never models because a broker cannot
   put a listing into them — SOLD and EXPIRED happen to it, REMOVED and
   DUPLICATE are done to it. The spine reports the lifecycle, not the workflow,
   so it needs the whole union. */
export type ListingLifecycle = DraftStatus | "SOLD" | "EXPIRED" | "REMOVED" | "DUPLICATE";

export type ListingEventType =
  /** The listing became publicly visible. */
  | "listing.published"
  /** It left public visibility: rejected, archived, or removed. */
  | "listing.unpublished"
  /** Approved, but near-duplicate of an existing listing, so its page
      canonicals to that one rather than standing on its own. */
  | "listing.canonicalized"
  /** Approval was refused by the publish gate. Carries the reasons. */
  | "listing.gate_blocked";

export type ListingEvent = {
  type: ListingEventType;
  /** Stable identity across moderation cycles and edits. */
  stableId: string;
  draftId?: string;
  localitySlug?: string;
  citySlug?: string;
  previousLifecycle: ListingLifecycle | null;
  nextLifecycle: ListingLifecycle | null;
  at: string;
  /** Reasons for a `gate_blocked`, the canonical target for a
      `canonicalized`, and the acting session for everything. */
  meta?: Record<string, unknown>;
};

export type ListingEventListener = (event: ListingEvent) => void | Promise<void>;

const listeners: ListingEventListener[] = [];

/* A short ring, not a log. Its job is to make the spine observable while it
   is young: "did anything actually emit?" is the first question you ask when
   a downstream system does not fire, and with no subscribers and no history
   that question is unanswerable. It is capped because an event bus that grows
   without bound in a long-lived server is a leak wearing a feature costume. */
const RECENT_LIMIT = 200;
const recent: ListingEvent[] = [];

/** Subscribe to listing lifecycle events. Returns an unsubscribe function. */
export function onListingEvent(listener: ListingEventListener): () => void {
  listeners.push(listener);
  return () => {
    const index = listeners.indexOf(listener);
    if (index >= 0) listeners.splice(index, 1);
  };
}

/* Emit, isolating every listener.

   A throwing subscriber must never break the write that triggered it. The
   moderation call that published a listing has already succeeded at the
   database level by the time listeners run; letting a downstream revalidation
   or indexing failure roll that back would mean the listing is live in the
   database but the moderator saw an error and will click approve again.

   The isolation is per-listener, not around the whole set, so one broken
   subscriber does not silence the healthy ones. */
export async function emitListingEvent(
  input: Omit<ListingEvent, "at"> & { at?: string },
): Promise<ListingEvent> {
  const event: ListingEvent = { ...input, at: input.at ?? new Date().toISOString() };

  recent.push(event);
  if (recent.length > RECENT_LIMIT) recent.splice(0, recent.length - RECENT_LIMIT);

  for (const listener of [...listeners]) {
    try {
      await listener(event);
    } catch {
      /* see the comment above */
    }
  }

  return event;
}

/** The most recent events, oldest first. For diagnostics and tests. */
export function recentListingEvents(): readonly ListingEvent[] {
  return [...recent];
}

export function resetListingEventBusForTests(): void {
  listeners.length = 0;
  recent.length = 0;
}
