import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const worker = readFileSync("src/lib/whatsapp/worker.ts", "utf8");
const purge = readFileSync("ops/scripts/privacy/purge-expired-leads.mjs", "utf8");

describe("WhatsApp retention safety", () => {
  it("filters deleted and retention-expired leads before a worker claim", () => {
    expect(worker).toContain("lead: { is: { organizationId, deletedAt: null, retentionUntil: { gt: now } } }");
    expect(worker).toContain("if (row.lead.deletedAt ||");
    expect(worker).toContain('"LEAD_EXPIRED"');
    expect(worker).toContain('"LEAD_DELETED"');
  });

  it("terminalizes sendable dispatches before clearing lead contact data", () => {
    expect(purge).toContain("await tx.whatsappDispatch.updateMany");
    expect(purge).toContain('["PENDING", "IN_FLIGHT", "UNKNOWN"]');
    expect(purge).toContain('status: "SKIPPED"');
    expect(purge).toContain('phoneCiphertext: null');
    expect(purge).toContain('phoneLast4: null');
    expect(purge).toContain('deletedAt: asOf');
  });

  it("does not select rendered message or provider payload fields in the purge path", () => {
    expect(purge).not.toContain("template.body");
    expect(purge).not.toContain("providerMessageId");
    expect(purge).not.toContain("payloadHash");
  });
});
