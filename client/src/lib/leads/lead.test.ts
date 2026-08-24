import { describe, expect, it, beforeEach } from "vitest";
import { POST } from "../../../../app/api/leads/route";
import { createLead, maskPhone, resetLeadStoreForTests, validateLeadInput } from "./lead";

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

  it("returns JSON from the API route", async () => {
    const response = await POST(new Request("http://example.com/api/leads", {
      method: "POST",
      body: JSON.stringify({ listingId: "garden-courtyard", name: "Kinjal Shah", phone: "+91 98765 43210", message: "Please send more details about this listing.", consentText: "I consent to masked contact for this enquiry.", idempotencyKey: "api-lead-test-1" }),
    }));
    expect(response.status).toBe(201);
    expect(response.headers.get("X-Architech-Lead-Mode")).toBe("MASKED");
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.lead.auditEvent.id).toMatch(/^audit_/);
  });
});
