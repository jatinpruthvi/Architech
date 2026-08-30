/* The event spine's contract.

   The property that matters is isolation, and it is the one that is easiest to
   get wrong and hardest to notice. A spine that lets a subscriber's exception
   propagate turns every downstream failure into a failed moderation decision —
   a listing that is already written to the database would surface to the
   moderator as an error, and they would click approve again.

   The second property is that this is a *choke point*, not a convenience. The
   test that matters for that lives in publish-gate.test.ts, which asserts that
   moderating a draft emits. This file covers the mechanism; that one covers
   the wiring. */
import { beforeEach, describe, expect, it } from "vitest";
import { emitListingEvent, onListingEvent, recentListingEvents, resetListingEventBusForTests, type ListingEvent } from "./events";

function event(overrides: Partial<ListingEvent> = {}) {
  return {
    type: "listing.published" as const,
    stableId: "listing_abc",
    previousLifecycle: "IN_REVIEW" as const,
    nextLifecycle: "ACTIVE" as const,
    ...overrides,
  };
}

describe("listing event spine", () => {
  beforeEach(resetListingEventBusForTests);

  it("delivers to a subscriber", async () => {
    const seen: ListingEvent[] = [];
    onListingEvent((e) => {
      seen.push(e);
    });
    await emitListingEvent(event());
    expect(seen).toHaveLength(1);
    expect(seen[0].stableId).toBe("listing_abc");
  });

  it("stamps the event once, at emit time", async () => {
    const emitted = await emitListingEvent(event());
    expect(emitted.at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(recentListingEvents().map((e) => e.at)).toEqual([emitted.at]);
  });

  it("stops delivering after unsubscribe", async () => {
    const seen: ListingEvent[] = [];
    const off = onListingEvent((e) => {
      seen.push(e);
    });
    await emitListingEvent(event());
    off();
    await emitListingEvent(event());
    expect(seen).toHaveLength(1);
  });

  it("isolates a throwing subscriber from the caller", async () => {
    // The whole reason the spine exists in this shape. If this test ever
    // fails, moderation breaks whenever revalidation or indexing misbehaves.
    const seen: string[] = [];
    onListingEvent(() => {
      throw new Error("subscriber exploded");
    });
    onListingEvent(() => {
      seen.push("survived");
    });
    await expect(emitListingEvent(event())).resolves.toBeTruthy();
    expect(seen).toEqual(["survived"]);
  });

  it("isolates a rejecting async subscriber from the caller", async () => {
    onListingEvent(async () => {
      throw new Error("async subscriber exploded");
    });
    await expect(emitListingEvent(event())).resolves.toBeTruthy();
  });

  it("awaits async subscribers before returning", async () => {
    const order: string[] = [];
    onListingEvent(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      order.push("subscriber");
    });
    await emitListingEvent(event());
    order.push("after emit");
    expect(order).toEqual(["subscriber", "after emit"]);
  });

  it("keeps a bounded history so the spine is observable", async () => {
    for (let index = 0; index < 260; index += 1) {
      await emitListingEvent(event({ stableId: `listing_${index}` }));
    }
    const recent = recentListingEvents();
    expect(recent).toHaveLength(200);
    // Oldest dropped, newest kept: the history answers "did anything fire
    // recently", not "what happened last month".
    expect(recent[recent.length - 1].stableId).toBe("listing_259");
  });

  it("records a blocked publish with its reasons", async () => {
    const emitted = await emitListingEvent(
      event({ type: "listing.gate_blocked", nextLifecycle: null, meta: { blockers: ["Attach at least one photograph."] } }),
    );
    expect(emitted.type).toBe("listing.gate_blocked");
    expect(emitted.meta?.blockers).toEqual(["Attach at least one photograph."]);
  });
});
