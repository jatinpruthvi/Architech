import { beforeEach, describe, expect, it } from "vitest";
import { getPersistenceMode, isPrismaPersistence } from "./source";
import { requestReraCorrectionForServer, markReraStaleForServer } from "./rera-store";
import { createMediaUploadForServer, completeMediaUploadForServer, moderateMediaForServer } from "./media-store";
import { createListingDraftForServer, submitListingForReviewForServer, moderateListingForServer, getModerationQueueForServer, listBrokerDraftsForServer, attachMediaToDraftForServer, detachMediaFromDraftForServer, listDraftMediaForServer } from "./broker-store";
import { resetBrokerWorkflowForTests } from "@/lib/broker/workflow";
import type { ListingDraftInput } from "@/lib/broker/workflow";
import { resetMediaStoreForTests } from "@/lib/media/upload";
import { resetReraStoreForTests } from "@/lib/rera/rera";

const draftInput: ListingDraftInput = {
  organizationId: "org_demo",
  title: "A courtyard home in Paldi",
  localitySlug: "paldi",
  priceInr: 18_500_000,
  bhk: 3,
  areaSqft: 1482,
  propertyType: "APARTMENT",
  availability: "READY_TO_MOVE",
  description: "Old trees, kota stone floors, and a courtyard that carries the whole house through the day.",
  mediaRightsConfirmed: true,
};

describe("persistence adapter source resolution", () => {
  it("defaults to the fixture source in this environment", () => {
    expect(getPersistenceMode()).toBe("fixture");
    expect(isPrismaPersistence()).toBe(false);
  });

  it("selects prisma when ARCHITECH_DATA_SOURCE=prisma", () => {
    expect(getPersistenceMode("prisma")).toBe("prisma");
    expect(isPrismaPersistence("prisma")).toBe(true);
    expect(getPersistenceMode("anything-else")).toBe("fixture");
  });
});

describe("broker draft persistence (fixture/memory path)", () => {
  beforeEach(() => resetBrokerWorkflowForTests());

  it("creates, submits and moderates a draft through the server adapter", async () => {
    const created = await createListingDraftForServer(draftInput);
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.draft.status).toBe("DRAFT");

    const submitted = await submitListingForReviewForServer(created.draft.id);
    expect(submitted.ok).toBe(true);
    if (submitted.ok) expect(submitted.draft.status).toBe("IN_REVIEW");

    const queue = await getModerationQueueForServer();
    expect(queue.map((draft) => draft.id)).toContain(created.draft.id);

    const moderated = await moderateListingForServer(created.draft.id, "approve", "Facts verified against source.");
    expect(moderated.ok).toBe(true);
    if (moderated.ok) expect(moderated.draft.status).toBe("ACTIVE");
  });

  it("lists a broker's own drafts across statuses, newest-edit-first", async () => {
    const first = await createListingDraftForServer({ ...draftInput, title: "Courtyard draft one" });
    const second = await createListingDraftForServer({ ...draftInput, title: "Courtyard draft two" });
    if (!first.ok || !second.ok) throw new Error("create failed");

    const drafts = await listBrokerDraftsForServer("demo-org-nivasa-partners");
    expect(drafts.map((draft) => draft.title)).toContain("Courtyard draft one");
    expect(drafts.map((draft) => draft.title)).toContain("Courtyard draft two");
    // newest-edit-first ordering is stable
    expect(drafts[0].updatedAt >= drafts[1].updatedAt).toBe(true);
  });

  it("attaches and detaches media on a broker draft", async () => {
    const created = await createListingDraftForServer(draftInput);
    if (!created.ok) throw new Error("create failed");

    const attached = await attachMediaToDraftForServer(created.draft.id, "media_courtyard_01");
    expect(attached.ok).toBe(true);
    if (attached.ok) expect(attached.mediaIds).toEqual(["media_courtyard_01"]);

    expect(await listDraftMediaForServer(created.draft.id)).toEqual(["media_courtyard_01"]);

    const detached = await detachMediaFromDraftForServer(created.draft.id, "media_courtyard_01");
    expect(detached.ok).toBe(true);
    if (detached.ok) expect(detached.mediaIds).toEqual([]);

    expect(await listDraftMediaForServer("does-not-exist")).toEqual([]);
  });
});

describe("RERA correction persistence (fixture/memory path)", () => {
  beforeEach(() => resetReraStoreForTests());

  it("requests a correction and marks the record stale via the server adapter", async () => {
    const correction = await requestReraCorrectionForServer({
      registrationNumber: "GJ/RERA/AHM/2026/04821-DEMO",
      field: "promoterName",
      currentValue: "Nivasa Partners",
      proposedValue: "Nivasa Partners LLP",
      reason: "Promoter legal suffix is missing from the source record.",
      reporterEmail: "reviewer@example.com",
    });
    expect(correction.ok).toBe(true);
    if (correction.ok) expect(correction.correction.status).toBe("REQUESTED");

    const stale = await markReraStaleForServer("GJ/RERA/AHM/2026/04821-DEMO");
    expect(stale.ok).toBe(true);
    if (stale.ok) expect(stale.record.verificationStatus).toBe("STALE");
  });
});

describe("media upload persistence (fixture/memory path)", () => {
  beforeEach(() => resetMediaStoreForTests());

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

  it("signs, completes and moderates a media record through the server adapter", async () => {
    const signed = await createMediaUploadForServer(mediaInput);
    expect(signed.ok).toBe(true);
    if (!signed.ok) return;
    expect(signed.upload.moderationStatus).toBe("PENDING");

    const completed = await completeMediaUploadForServer(signed.upload.id);
    expect(completed.ok).toBe(true);
    if (completed.ok) expect(completed.upload.derivatives.every((d) => d.status === "ready")).toBe(true);

    const moderated = await moderateMediaForServer(signed.upload.id, "APPROVED", "Rights confirmed.");
    expect(moderated.ok).toBe(true);
    if (moderated.ok) expect(moderated.upload.moderationStatus).toBe("APPROVED");
  });
});
