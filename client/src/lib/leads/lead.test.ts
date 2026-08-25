import { beforeEach, describe, expect, it } from "vitest";
import { createLead, listLeads, maskPhone, resetLeadStoreForTests, updateLeadStatus, validateLeadInput } from "./lead";
import { getLeadStorageMode } from "./source";

describe("lead consent/audit workflow", () => {
  beforeEach(() => resetLeadStoreForTests());

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
});
