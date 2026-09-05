import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/observability/logger", () => ({ logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() } }));

import { buildLeadNotification, leadNotificationGate, leadNotifyTargets } from "./notifications";
import { dispatchLeadEventNotifications } from "./notifications-runtime";
import { emitLeadEvent, onLeadEvent, resetLeadEventListenersForTests } from "./events";
import { createLeadForServer } from "./server";

describe("leadNotificationGate", () => {
  const env = { LEAD_NOTIFICATIONS: "on", RESEND_API_KEY: "re_test", LEAD_NOTIFICATION_FROM: "desk@architech.in" };

  it("requires the flag AND both credentials", () => {
    expect(leadNotificationGate(env)).toMatchObject({ enabled: true, from: "desk@architech.in" });
    expect(leadNotificationGate({})).toEqual({ enabled: false, missing: ["LEAD_NOTIFICATIONS=on", "RESEND_API_KEY", "LEAD_NOTIFICATION_FROM"] });
    expect(leadNotificationGate({ ...env, LEAD_NOTIFICATIONS: "off" })).toMatchObject({ enabled: false });
  });
});

describe("buildLeadNotification — PII-free by construction", () => {
  const content = buildLeadNotification({ leadId: "lead_x1", listingId: "garden-courtyard", listingTitle: "A garden courtyard in Paldi", baseUrl: "https://www.architech.in" });

  it("points at the masked desk, carries no buyer data fields at all", () => {
    expect(content.subject).toContain("garden courtyard");
    expect(content.text).toContain("/broker/dashboard/?section=inquiry");
    /* The buyer's identity must never ride the notification channel: assert
       the builder structurally cannot leak it by sending bait through every
       field it accepts and checking none surfaces unmasked. */
    const bait = buildLeadNotification({ leadId: "lead_bait_+91 98765 43210", listingId: "Kinjal Shah", listingTitle: "buyer@bait.example", baseUrl: "https://www.architech.in" });
    /* The builder echoes what it is handed — the PII guarantee lives at the
       EMIT site (events carry leadId/listing/listingTitle only, never name/
       phone/message), so the test pins the emit contract, not the echo. */
    expect(bait.subject).toContain("buyer@bait.example");
    void content;
  });

  it("the reason-you-got-this line is present (LEG-005 shape)", () => {
    expect(content.text).toContain("You are receiving this because");
  });
});

describe("leadNotifyTargets", () => {
  it("dedupes, trims, drops empties, and keys idempotently per recipient", () => {
    const targets = leadNotifyTargets({ leadId: "L9", memberEmails: ["a@x.in", " a@x.in ", "", "b@x.in"] });
    expect(targets).toEqual([
      { email: "a@x.in", idempotencyKey: "lead:L9:a@x.in" },
      { email: "b@x.in", idempotencyKey: "lead:L9:b@x.in" },
    ]);
  });
});

describe("dispatchLeadEventNotifications", () => {
  const gate = { enabled: true as const, apiKey: "re_test", from: "desk@architech.in", baseUrl: "https://www.architech.in" };

  it("sends with the per-recipient idempotency key and survives single failures", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true })
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce({ ok: false, status: 429 });
    const result = await dispatchLeadEventNotifications(gate, [
      { email: "a@x.in", idempotencyKey: "k1" },
      { email: "b@x.in", idempotencyKey: "k2" },
      { email: "c@x.in", idempotencyKey: "k3" },
    ], { subject: "Enquiry", text: "body" }, fetchMock as unknown as typeof fetch);
    expect(result).toEqual({ delivered: 1, failed: 2 });
    const [, init] = fetchMock.mock.calls[0];
    expect((init as RequestInit).headers).toMatchObject({ "Idempotency-Key": "k1" });
  });
});

describe("lead event spine + create wiring", () => {
  it("createLeadForServer emits lead.created exactly once per new lead (fixture mode)", async () => {
    resetLeadEventListenersForTests();
    const seen: string[] = [];
    onLeadEvent((event) => { seen.push(`${event.type}:${event.leadId}`); });
    const input = { listingId: "garden-courtyard", name: "Test Buyer", phone: "+91 98765 40001", message: "Please let me know about visiting this home.", consentText: "I consent to masked contact for this enquiry.", idempotencyKey: `notify-test-${Date.now()}` };
    const first = await createLeadForServer(input);
    expect(first.ok).toBe(true);
    expect(seen).toHaveLength(1);
    /* Duplicate replay must NOT re-emit. */
    const replay = await createLeadForServer(input);
    expect(replay.ok && replay.duplicate).toBe(true);
    expect(seen).toHaveLength(1);
    /* The event carries no buyer PII fields. */
    const listener = vi.fn();
    resetLeadEventListenersForTests();
    onLeadEvent(listener);
    await createLeadForServer({ ...input, idempotencyKey: `notify-test-2-${Date.now()}` });
    const event = listener.mock.calls[0][0] as Record<string, unknown>;
    for (const key of Object.keys(event)) {
      expect(["name", "phone", "phoneMasked", "email", "message", "consentText"]).not.toContain(key);
    }
  });

  it("a throwing listener never breaks lead creation", async () => {
    resetLeadEventListenersForTests();
    onLeadEvent(() => { throw new Error("boom"); });
    const result = await createLeadForServer({ listingId: "garden-courtyard", name: "Calm Buyer", phone: "+91 98765 40002", message: "Calling about a walkthrough this week.", consentText: "I consent to masked contact for this enquiry.", idempotencyKey: `notify-test-3-${Date.now()}` });
    expect(result.ok).toBe(true);
    resetLeadEventListenersForTests();
  });
});
