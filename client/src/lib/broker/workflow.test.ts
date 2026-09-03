import { beforeEach, describe, expect, it } from "vitest";
import { POST as createDraftRoute } from "../../../../app/api/broker/listings/route";
import { PATCH as updateDraftRoute, POST as lifecycleDraftRoute, DELETE as deleteDraftRoute } from "../../../../app/api/broker/listings/[draftId]/route";
import { POST as submitDraftRoute } from "../../../../app/api/broker/listings/[draftId]/submit/route";
import { POST as moderateDraftRoute } from "../../../../app/api/admin/moderation/listings/[draftId]/route";
import { demoBrokerSession } from "@/lib/auth/roles";
import { archiveListingDraft, createListingDraft, deleteListingDraft, getModerationQueue, moderateListing, resetBrokerWorkflowForTests, resumeListingDraft, submitListingForReview, updateListingDraft, validateBrokerProfile, validateListingDraft, type ListingDraftInput } from "./workflow";

const validDraft: ListingDraftInput = {
  title: "A verified garden apartment",
  citySlug: "ahmedabad",
  localitySlug: "paldi",
  postalCode: "380007",
  priceInr: 18500000,
  bhk: 3,
  areaSqft: 1482,
  propertyType: "APARTMENT",
  availability: "READY_TO_MOVE",
  description: "A verified apartment draft with enough source context for moderation review.",
  reraNumber: "GJ/RERA/AHM/2026/04821-DEMO",
  mediaRightsConfirmed: true,
};

describe("broker onboarding and listing moderation workflow", () => {
  beforeEach(() => resetBrokerWorkflowForTests());

  it("validates broker profile requirements", () => {
    expect(validateBrokerProfile({ organizationName: "Nivasa", email: "team@example.com", citySlug: "ahmedabad", consentText: "I confirm rights." })).toEqual([]);
    expect(validateBrokerProfile({ organizationName: "", email: "bad", citySlug: "surat", consentText: "" }).length).toBeGreaterThan(2);
  });

  it("validates listing draft requirements", () => {
    expect(validateListingDraft(validDraft)).toEqual([]);
    expect(validateListingDraft({ ...validDraft, mediaRightsConfirmed: false })).toContain("Media rights confirmation is required before review.");
  });

  describe("listing attribution (owner vs broker)", () => {
    /* The account declaration seeds the checkbox; the listing value is what a
       buyer is shown, so it must be independently settable and must survive
       edits. */
    const brokerAccount = { ...demoBrokerSession, user: { ...demoBrokerSession.user, listerType: "BROKER" as const } };
    const ownerAccount = { ...demoBrokerSession, user: { ...demoBrokerSession.user, listerType: "OWNER" as const } };

    it("defaults a new draft to the account's sign-up declaration", () => {
      const asBroker = createListingDraft({ ...validDraft }, brokerAccount);
      expect(asBroker.ok && asBroker.draft.listerType).toBe("BROKER");

      resetBrokerWorkflowForTests();
      const asOwner = createListingDraft({ ...validDraft }, ownerAccount);
      expect(asOwner.ok && asOwner.draft.listerType).toBe("OWNER");
    });

    it("lets an explicit per-listing choice override the account default", () => {
      /* A broker listing their own home — the case that makes a per-listing
         field necessary rather than just reading the account. */
      const created = createListingDraft({ ...validDraft, listerType: "OWNER" }, brokerAccount);
      expect(created.ok && created.draft.listerType).toBe("OWNER");
    });

    it("falls back to OWNER when the account never declared one", () => {
      const undeclared = { ...demoBrokerSession, user: { ...demoBrokerSession.user, listerType: undefined } };
      const created = createListingDraft({ ...validDraft }, undeclared);
      expect(created.ok && created.draft.listerType).toBe("OWNER");
    });

    it("rejects an unreviewed attribution instead of coercing it", () => {
      expect(validateListingDraft({ ...validDraft, listerType: "LANDLORD" as never }))
        .toContain("Choose whether this listing is by the owner or by a broker.");
    });

    it("normalizes a loose spelling on the way into storage", () => {
      const created = createListingDraft({ ...validDraft, listerType: "agent" as never }, ownerAccount);
      expect(created.ok && created.draft.listerType).toBe("BROKER");
    });

    it("keeps the listing's own attribution across an edit that omits it", () => {
      const created = createListingDraft({ ...validDraft, listerType: "OWNER" }, brokerAccount);
      if (!created.ok) throw new Error("draft failed");
      /* An edit payload without `listerType` must not silently revert the
         listing to the account default — that would change buyer-facing
         attribution behind the broker's back. */
      const withoutAttribution: ListingDraftInput = { ...validDraft };
      delete withoutAttribution.listerType;
      const updated = updateListingDraft(created.draft.id, withoutAttribution, brokerAccount);
      expect(updated.ok && updated.draft.listerType).toBe("OWNER");
    });

    it("audits an attribution change explicitly", () => {
      const created = createListingDraft({ ...validDraft, listerType: "OWNER" }, brokerAccount);
      if (!created.ok) throw new Error("draft failed");
      const updated = updateListingDraft(created.draft.id, { ...validDraft, listerType: "BROKER" }, brokerAccount);
      if (!updated.ok) throw new Error("update failed");
      const entry = updated.draft.auditTrail.find((item) => item.metadata?.listerTypeChangedTo);
      expect(entry?.metadata).toMatchObject({ listerTypeChangedFrom: "OWNER", listerTypeChangedTo: "BROKER" });
    });
  });

  it("creates, submits, and moderates a listing draft", () => {
    const created = createListingDraft(validDraft);
    expect(created.ok && created.draft.status).toBe("DRAFT");
    if (!created.ok) throw new Error("draft failed");
    const submitted = submitListingForReview(created.draft.id);
    expect(submitted.ok && submitted.draft.status).toBe("IN_REVIEW");
    expect(getModerationQueue()).toHaveLength(1);
    const moderated = moderateListing(created.draft.id, "approve", "Source trail complete.");
    expect(moderated.ok && moderated.draft.status).toBe("ACTIVE");
  });

  it("supports safe draft lifecycle operations", () => {
    const created = createListingDraft(validDraft);
    if (!created.ok) throw new Error("draft failed");
    const updated = updateListingDraft(created.draft.id, { ...validDraft, title: "Updated garden apartment draft" });
    expect(updated.ok && updated.draft.status).toBe("DRAFT");
    const archived = archiveListingDraft(created.draft.id);
    expect(archived.ok && archived.draft.status).toBe("ARCHIVED");
    const resumed = resumeListingDraft(created.draft.id);
    expect(resumed.ok && resumed.draft.status).toBe("DRAFT");
    const deleted = deleteListingDraft(created.draft.id);
    expect(deleted.ok).toBe(true);
    const missing = deleteListingDraft(created.draft.id);
    expect(missing.ok ? 200 : missing.status).toBe(404);
  });

  it("exposes lifecycle API route contracts", async () => {
    const createResponse = await createDraftRoute(new Request("http://example.com/api/broker/listings", { method: "POST", body: JSON.stringify(validDraft) }));
    expect(createResponse.status).toBe(201);
    const created = await createResponse.json();
    const updateResponse = await updateDraftRoute(new Request("http://example.com", { method: "PATCH", body: JSON.stringify({ ...validDraft, title: "Updated garden apartment draft" }) }), { params: Promise.resolve({ draftId: created.draft.id }) });
    expect(updateResponse.status).toBe(200);
    const archiveResponse = await lifecycleDraftRoute(new Request("http://example.com", { method: "POST", headers: { "x-draft-action": "archive" } }), { params: Promise.resolve({ draftId: created.draft.id }) });
    expect(archiveResponse.status).toBe(200);
    const deleteResponse = await deleteDraftRoute(new Request("http://example.com", { method: "DELETE" }), { params: Promise.resolve({ draftId: created.draft.id }) });
    expect(deleteResponse.status).toBe(200);
  });

  it("exposes API route contracts", async () => {
    const createResponse = await createDraftRoute(new Request("http://example.com/api/broker/listings", { method: "POST", body: JSON.stringify(validDraft) }));
    expect(createResponse.status).toBe(201);
    const created = await createResponse.json();

    const submitResponse = await submitDraftRoute(new Request("http://example.com"), { params: Promise.resolve({ draftId: created.draft.id }) });
    expect(submitResponse.status).toBe(200);

    const moderateResponse = await moderateDraftRoute(new Request("http://example.com", { method: "POST", body: JSON.stringify({ decision: "request_changes", reason: "Upload floor plan." }) }), { params: Promise.resolve({ draftId: created.draft.id }) });
    const moderated = await moderateResponse.json();
    expect(moderated.draft.status).toBe("CHANGES_REQUESTED");
  });
});
