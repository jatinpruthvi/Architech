import { beforeEach, describe, expect, it } from "vitest";
import { createLead, findLeadForOrganization, listActiveLeads, listLeads, maskPhone, resetLeadStoreForTests, revokeLeadConsent, softDeleteLead, updateLeadStatus, validateLeadInput } from "./lead";
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
