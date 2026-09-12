import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { demoBrokerSession } from "@/lib/auth/roles";
import { createLead, fixtureLeadDetail, findLeadForOrganization, listActiveLeads, listLeads, maskPhone, recordFixtureCall, resetLeadStoreForTests, revokeLeadConsent, softDeleteLead, updateLeadStatus, validateLeadInput } from "./lead";
import { getLeadStorageMode } from "./source";

const ORG = "org-alpha";
const OTHER_ORG = "org-beta";

describe("lead consent/audit workflow", () => {
  beforeEach(() => resetLeadStoreForTests());

  it("keeps each organization's inbox to itself", () => {
    /* A lead carries a buyer's name, masked phone, message and the listing
       they asked about. An unscoped inbox exposed every broker's live
       pipeline to every competitor on the platform. */
    const mine = createLead({ listingId: "garden-courtyard", organizationId: ORG, name: "Kinjal Shah", phone: "+91 98765 43210", message: "I would like more details.", consentText: "I consent to masked contact.", idempotencyKey: "org-scope-1" });
    createLead({ listingId: "garden-courtyard", organizationId: OTHER_ORG, name: "Rival Buyer", phone: "+91 91234 56780", message: "Please share the floor plan.", consentText: "I consent to masked contact.", idempotencyKey: "org-scope-2" });
    if (!mine.ok) throw new Error("create failed");

    expect(listActiveLeads(ORG)).toHaveLength(1);
    expect(listActiveLeads(ORG)[0].name).toBe("Kinjal Shah");
    expect(listActiveLeads(OTHER_ORG).map((l) => l.name)).toEqual(["Rival Buyer"]);

    /* Knowing the id is not enough to reach a foreign lead. */
    expect(findLeadForOrganization(mine.lead.id, OTHER_ORG)).toBeNull();
    expect(findLeadForOrganization(mine.lead.id, ORG)?.id).toBe(mine.lead.id);
  });

  it("returns nothing for an empty organization id rather than everything", () => {
    createLead({ listingId: "garden-courtyard", organizationId: ORG, name: "Kinjal Shah", phone: "+91 98765 43210", message: "I would like more details.", consentText: "I consent to masked contact.", idempotencyKey: "org-scope-3" });
    expect(listActiveLeads("")).toEqual([]);
    expect(findLeadForOrganization("anything", "")).toBeNull();
  });

  it("masks phone numbers", () => {
    expect(maskPhone("+91 98765 43210")).toBe("•••• ••• 3210");
  });

  it("validates required lead fields", () => {
    const errors = validateLeadInput({ listingId: "fake", name: "A", phone: "12", message: "short", consentText: "" });
    expect(errors.length).toBeGreaterThanOrEqual(4);
  });

  it("defaults automated WhatsApp eligibility off and keeps the retry key opaque", () => {
    const result = createLead({ listingId: "garden-courtyard", name: "Opt Out Buyer", phone: "+91 98765 43210", message: "I would like more details about this home.", consentText: "I consent to masked contact for this enquiry." });
    expect(result.ok && result.lead.whatsappOptIn).toBe(false);
    expect(result.ok && result.lead.idempotencyKey).toMatch(/^lead\.v1\.[a-f0-9]{64}$/);
    expect(result.ok && result.lead.idempotencyKey).not.toContain("9876543210");
  });

  it("stores bounded WhatsApp opt-in copy and a server capture time", () => {
    const result = createLead({ listingId: "garden-courtyard", name: "Opt In Buyer", phone: "+91 98765 43210", message: "I would like more details about this home.", consentText: "I consent to masked contact for this enquiry.", whatsappOptIn: true, whatsappOptInText: "Please send one acknowledgement about this enquiry." });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.lead.whatsappOptIn).toBe(true);
      expect(result.lead.whatsappOptInText).toContain("one acknowledgement");
      expect(result.lead.whatsappOptInAt).toMatch(/^20/);
    }
  });

  it("creates idempotent masked leads with audit metadata", () => {
    const input = { listingId: "garden-courtyard", name: "Kinjal Shah", phone: "+91 98765 43210", message: "I would like to visit this home this week.", consentText: "I consent to masked contact for this enquiry.", idempotencyKey: "lead-test-1" };
    const first = createLead(input);
    const second = createLead(input);
    expect(first.ok && first.lead.phoneMasked).toBe("•••• ••• 3210");
    expect(first.ok && first.lead.auditEvent.action).toBe("lead.created");
    expect(second.ok && second.duplicate).toBe(true);
  });

  it("keeps lead storage in memory unless configured for Prisma", () => {
    expect(getLeadStorageMode(undefined)).toBe("memory");
    expect(getLeadStorageMode("prisma")).toBe("prisma");
  });

  it("lists leads newest-first and advances status with an audit trail", () => {
    const input = { listingId: "garden-courtyard", name: "Kinjal Shah", phone: "+91 98765 43210", message: "I would like to visit this home this week.", consentText: "I consent to masked contact for this enquiry.", idempotencyKey: "lead-inbox-1" };
    const first = createLead(input);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.lead.statusHistory[0].action).toBe("lead.created");

    const replied = updateLeadStatus(first.lead.id, "REPLIED");
    expect(replied.ok).toBe(true);
    if (replied.ok) expect(replied.lead.status).toBe("REPLIED");
    expect(replied.ok && replied.lead.statusHistory.at(-1)?.action).toBe("lead.replied");

    expect(listLeads().map((lead) => lead.status)).toContain("REPLIED");

    const missing = updateLeadStatus("does-not-exist", "CLOSED");
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.status).toBe(404);
  });

  it("soft-deletes and consent-revokes a lead, excluding it from the active inbox", () => {
    const input = { listingId: "garden-courtyard", organizationId: ORG, name: "Kinjal Shah", phone: "+91 98765 43210", message: "I would like more details.", consentText: "I consent to masked contact.", idempotencyKey: "lead-delete-1" };
    const created = createLead(input);
    if (!created.ok) throw new Error("create failed");
    expect(listActiveLeads(ORG)).toHaveLength(1);

    const deleted = softDeleteLead(created.lead.id);
    expect(deleted.ok).toBe(true);
    if (deleted.ok) expect(deleted.lead.status).toBe("DELETED");
    expect(listActiveLeads(ORG)).toHaveLength(0);
    expect(listLeads()).toHaveLength(1); // soft-deleted still in full store

    const revoked = revokeLeadConsent(created.lead.id);
    expect(revoked.ok).toBe(true);
    if (revoked.ok) expect(revoked.lead.status).toBe("DELETED");
  });
});

describe("fixture call state (both-store parity, spec §5)", () => {
  beforeEach(() => {
    resetLeadStoreForTests();
    vi.stubEnv("ARCHITECH_LEAD_STORAGE", "memory");
  });
  afterEach(() => vi.unstubAllEnvs());

  const createLeadForServerSync = () =>
    createLead({
      listingId: "garden-courtyard",
      name: "Test Buyer",
      phone: "07941234567",
      message: "Is this 3 BHK still available this week?",
      consentText: "I agree to being contacted about this enquiry.",
      organizationId: demoBrokerSession.organization?.id ?? null,
    });

  function makeLead() {
    const result = createLeadForServerSync();
    if (!result.ok) throw new Error("fixture lead should create");
    return result.lead.id;
  }

  it("createLead defaults consentClass to first-party-form like the prisma path", async () => {
    const { createLeadForServer } = await import("./server");
    const result = await createLeadForServer({
      listingId: "garden-courtyard",
      name: "Consent Buyer",
      phone: "07941234568",
      message: "Is this 3 BHK still available this week?",
      consentText: "I agree to being contacted about this enquiry.",
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.lead.consentClass).toBe("first-party-form");
  });

  it("recordFixtureCall advances stage, attempts and suppression", () => {
    const id = makeLead();
    recordFixtureCall(id, { outcome: "NO_ANSWER", stageBefore: "NEW", stageAfter: "CONTACTED", nextActionAt: "2026-09-11T09:00:00.000Z", note: "ringing", lostReason: null });
    const detail = fixtureLeadDetail(id, demoBrokerSession.organization!.id)!;
    expect(detail.stage).toBe("CONTACTED");
    expect(detail.callAttempts).toBe(1);
    expect(detail.suppressed).toBe(false);
    expect(detail.nextActionAt).toBe("2026-09-11T09:00:00.000Z");
    expect(detail.callHistory).toHaveLength(1);
    recordFixtureCall(id, { outcome: "NOT_INTERESTED", stageBefore: "CONTACTED", stageAfter: "LOST", nextActionAt: null, note: null, lostReason: "went with another broker" });
    const after = fixtureLeadDetail(id, demoBrokerSession.organization!.id)!;
    expect(after.suppressed).toBe(true);
    expect(after.callAttempts).toBe(2);
    expect(after.stage).toBe("LOST");
  });
});
