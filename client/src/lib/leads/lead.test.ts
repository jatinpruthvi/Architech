import { beforeEach, describe, expect, it } from "vitest";
import { createLead, maskPhone, resetLeadStoreForTests, validateLeadInput } from "./lead";
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
});
