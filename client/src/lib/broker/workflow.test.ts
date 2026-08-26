import { beforeEach, describe, expect, it } from "vitest";
import { POST as createDraftRoute } from "../../../../app/api/broker/listings/route";
import { POST as submitDraftRoute } from "../../../../app/api/broker/listings/[draftId]/submit/route";
import { POST as moderateDraftRoute } from "../../../../app/api/admin/moderation/listings/[draftId]/route";
import { createListingDraft, getModerationQueue, moderateListing, resetBrokerWorkflowForTests, submitListingForReview, validateBrokerProfile, validateListingDraft, type ListingDraftInput } from "./workflow";

const validDraft: ListingDraftInput = {
  title: "A verified garden apartment",
  localitySlug: "paldi",
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
