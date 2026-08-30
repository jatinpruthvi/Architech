/* The gate and the spine, wired into moderation.

   `publish-gate.test.ts` proves the rules are right. This file proves they are
   actually in the path — which is a different claim, and the one that fails
   silently. A gate placed *beside* a transition looks identical in a code
   review to a gate placed *inside* it, and behaves completely differently the
   first time someone adds a second write path.

   So the load-bearing test here is the first: approval of an incomplete draft
   must not merely fail, it must emit `listing.gate_blocked` and leave the draft
   where it was. If someone later routes around the gate, this is what breaks.

   In fixture mode the Prisma branch never runs, so these tests exercise the
   in-memory path — which is the default, and therefore the path that matters
   until step 0 lands. */
import { beforeEach, describe, expect, it } from "vitest";
import { attachMediaToDraftForServer, createListingDraftForServer, moderateListingForServer, submitListingForReviewForServer } from "./broker-store";
import { evaluateDraftPublishGate } from "./broker-store";
import { listAllDrafts, resetBrokerWorkflowForTests, type ListingDraftInput } from "@/lib/broker/workflow";
import { markMediaProcessingComplete, resetMediaStoreForTests } from "@/lib/media/upload";
import { completeMediaUploadForServer, createMediaUploadForServer, moderateMediaForServer } from "./media-store";
import { onListingEvent, recentListingEvents, resetListingEventBusForTests, type ListingEvent } from "@/lib/listing/events";

const DESCRIPTION =
  "Old trees, kota stone floors, and a courtyard that carries the whole house through the day. The bedrooms open onto it, so the light moves across the house rather than into it. The kitchen was rebuilt last year in teak, and the back verandah stays cool through the afternoon.";

function input(overrides: Partial<ListingDraftInput> = {}): ListingDraftInput {
  return {
    organizationId: "org_demo",
    title: "A courtyard home in Paldi",
    localitySlug: "paldi",
    priceInr: 18_500_000,
    bhk: 3,
    areaSqft: 1482,
    propertyType: "APARTMENT",
    availability: "RESALE",
    description: DESCRIPTION,
    mediaRightsConfirmed: true,
    ...overrides,
  };
}

/** Create, optionally attach media, and submit for review. */
async function inReview(overrides: Partial<ListingDraftInput> = {}, media: string[] = []) {
  const created = await createListingDraftForServer(input(overrides));
  if (!created.ok) throw new Error(`create failed: ${created.errors.join("; ")}`);
  for (const id of media) {
    const attached = await attachMediaToDraftForServer(created.draft.id, id);
    if (!attached.ok) throw new Error("attach failed");
  }
  await submitListingForReviewForServer(created.draft.id);
  return created.draft;
}

describe("the publish gate is in the approval path", () => {
  beforeEach(() => {
    resetBrokerWorkflowForTests();
    resetListingEventBusForTests();
  });

  it("refuses approval of a listing with no photographs, and says why", async () => {
    const draft = await inReview();
    const result = await moderateListingForServer(draft.id, "approve", "Looks good.");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(422);
    expect(result.errors.join(" ")).toMatch(/photograph/i);
  });

  it("leaves a blocked draft in review rather than advancing it", async () => {
    // A gate that fails the call but still mutates is worse than no gate.
    const draft = await inReview();
    await moderateListingForServer(draft.id, "approve", "Looks good.");
    expect(listAllDrafts().find((item) => item.id === draft.id)?.status).toBe("IN_REVIEW");
  });

  it("emits listing.gate_blocked with the reasons attached", async () => {
    const seen: ListingEvent[] = [];
    onListingEvent((event) => {
      seen.push(event);
    });
    const draft = await inReview();
    await moderateListingForServer(draft.id, "approve", "Looks good.");

    const blocked = seen.find((event) => event.type === "listing.gate_blocked");
    expect(blocked).toBeDefined();
    expect(blocked?.stableId).toBe(draft.stableId);
    expect(blocked?.previousLifecycle).toBe("IN_REVIEW");
    expect(blocked?.nextLifecycle).toBeNull();
    expect(blocked?.meta?.blockers).toBeTruthy();
    // No publish event: the gate is inside the transition, not after it.
    expect(seen.some((event) => event.type === "listing.published")).toBe(false);
  });

  it("approves a complete listing and emits listing.published", async () => {
    const seen: ListingEvent[] = [];
    onListingEvent((event) => {
      seen.push(event);
    });
    const draft = await inReview({}, ["media_courtyard_01"]);

    const result = await moderateListingForServer(draft.id, "approve", "Facts verified.");
    expect(result.ok).toBe(true);

    expect(seen.map((event) => event.type)).toContain("listing.published");
    const published = seen.find((event) => event.type === "listing.published");
    expect(published?.previousLifecycle).toBe("IN_REVIEW");
    expect(published?.nextLifecycle).toBe("ACTIVE");
    expect(published?.localitySlug).toBe("paldi");
    // The city is resolved from the locality, so consumers do not have to.
    expect(published?.citySlug).toBe("ahmedabad");
  });

  it("does not gate a decision that cannot make anything public", async () => {
    // Sending work back must never be refused: the listing is not becoming
    // visible, and gating it would trap the draft in review.
    const draft = await inReview();
    const result = await moderateListingForServer(draft.id, "request_changes", "Add photographs.");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.draft.status).toBe("CHANGES_REQUESTED");
  });

  it("reports rejection as leaving public visibility", async () => {
    const seen: ListingEvent[] = [];
    onListingEvent((event) => {
      seen.push(event);
    });
    const draft = await inReview({}, ["media_courtyard_01"]);
    await moderateListingForServer(draft.id, "reject", "Duplicate of an existing listing.");
    expect(seen.map((event) => event.type)).toEqual(["listing.unpublished"]);
  });
});

describe("duplicates are canonicalized, not refused or duplicated", () => {
  beforeEach(() => {
    resetBrokerWorkflowForTests();
    resetListingEventBusForTests();
  });

  it("emits listing.canonicalized pointing at the published twin", async () => {
    const seen: ListingEvent[] = [];
    onListingEvent((event) => {
      seen.push(event);
    });

    const first = await inReview({ title: "Courtyard home, Paldi" }, ["media_one"]);
    await moderateListingForServer(first.id, "approve", "First of its kind.");

    // Same description, same locality, second broker.
    const second = await inReview({ title: "Courtyard home in Paldi", organizationId: "org_other" }, ["media_two"]);
    const result = await moderateListingForServer(second.id, "approve", "Verified separately.");

    expect(result.ok).toBe(true);
    const canonicalized = seen.find((event) => event.type === "listing.canonicalized");
    expect(canonicalized).toBeDefined();
    expect(canonicalized?.meta?.canonicalToListingId).toBe(first.stableId);
    expect(seen.some((event) => event.type === "listing.published" && event.stableId === second.stableId)).toBe(false);
  });

  it("publishes rather than canonicalizing when the twin is still in review", async () => {
    // Pointing at a page that does not exist would be worse than a duplicate.
    const first = await inReview({ title: "Courtyard home, Paldi" }, ["media_one"]);
    const second = await inReview({ title: "Courtyard home in Paldi", organizationId: "org_other" }, ["media_two"]);

    const result = await moderateListingForServer(second.id, "approve", "Verified separately.");
    expect(result.ok).toBe(true);
    expect(first.stableId).not.toBe(second.stableId);
    expect(recentListingEvents().some((event) => event.type === "listing.canonicalized")).toBe(false);
  });
});

/* The gate promises a photograph the listing is allowed to show. A photo that
   has been taken down is not one, and counting it would publish a page whose
   image cannot be rendered — the precise rights failure the media pipeline
   exists to prevent. */
describe("a photograph that cannot be shown does not count", () => {
  const mediaInput = {
    listingDraftId: "draft_abc",
    fileName: "courtyard hero.jpg",
    mimeType: "image/jpeg",
    sizeBytes: 1_500_000,
    width: 1600,
    height: 1000,
    licenseEvidence: "Broker owns this photo and grants publication rights.",
    rightsConfirmed: true,
  };

  beforeEach(() => {
    resetBrokerWorkflowForTests();
    resetMediaStoreForTests();
    resetListingEventBusForTests();
  });

  it("publishes with an approved, EXIF-cleared photograph and blocks once it is taken down", async () => {
    const signed = await createMediaUploadForServer(mediaInput);
    if (!signed.ok) throw new Error("upload failed");
    await completeMediaUploadForServer(signed.upload.id);
    await moderateMediaForServer(signed.upload.id, "APPROVED", "Rights confirmed.");
    /* M-6: approval alone is not publishability. The EXIF-strip must have run —
       that is what the worker hook records, mirroring the real pipeline. */
    markMediaProcessingComplete(signed.upload.id, { exifStripped: true, derivativesReady: true });

    const draft = await inReview({}, [signed.upload.id]);
    const gate = evaluateDraftPublishGate(draft.id);
    if (!gate.ok) throw new Error("expected ok");
    expect(gate.decision.action).toBe("publish");

    await moderateMediaForServer(signed.upload.id, "TAKEDOWN_REQUESTED", "Rights withdrawn by owner.");
    const after = evaluateDraftPublishGate(draft.id);
    if (!after.ok) throw new Error("expected ok");
    expect(after.decision.action).toBe("block");
    expect(after.decision.blockers.join(" ")).toMatch(/photograph/i);
  });

  it("does not publish approved-but-unprocessed media (EXIF policy)", async () => {
    const signed = await createMediaUploadForServer(mediaInput);
    if (!signed.ok) throw new Error("upload failed");
    await completeMediaUploadForServer(signed.upload.id);
    await moderateMediaForServer(signed.upload.id, "APPROVED", "Rights confirmed.");

    const draft = await inReview({}, [signed.upload.id]);
    const gate = evaluateDraftPublishGate(draft.id);
    if (!gate.ok) throw new Error("expected ok");
    expect(gate.decision.action).toBe("block");
    expect(gate.decision.blockers.join(" ")).toMatch(/photograph/i);
  });

  it("does not publish on the strength of a pending upload", async () => {
    // PENDING is the default state. Counting it would make the media
    // moderation queue decorative.
    const signed = await createMediaUploadForServer(mediaInput);
    if (!signed.ok) throw new Error("upload failed");
    const draft = await inReview({}, [signed.upload.id]);

    const gate = evaluateDraftPublishGate(draft.id);
    if (!gate.ok) throw new Error("expected ok");
    expect(gate.decision.action).toBe("block");
  });
});

describe("evaluateDraftPublishGate", () => {
  beforeEach(resetBrokerWorkflowForTests);

  it("explains itself for a draft that cannot publish", async () => {
    const draft = await inReview();
    const gate = evaluateDraftPublishGate(draft.id);
    expect(gate.ok).toBe(true);
    if (!gate.ok) return;
    expect(gate.decision.action).toBe("block");
    expect(gate.decision.blockers.length).toBeGreaterThan(0);
  });

  it("reports a 404 for a draft that does not exist", () => {
    expect(evaluateDraftPublishGate("nope")).toMatchObject({ ok: false, status: 404 });
  });

  it("recovers once the broker attaches a photograph", async () => {
    // The gate must be escapable by doing the work, not by arguing with it.
    const draft = await inReview();
    expect(evaluateDraftPublishGate(draft.id)).toMatchObject({ ok: true });
    await attachMediaToDraftForServer(draft.id, "media_late_arrival");

    const gate = evaluateDraftPublishGate(draft.id);
    if (!gate.ok) throw new Error("expected ok");
    expect(gate.decision.action).toBe("publish");
  });
});
