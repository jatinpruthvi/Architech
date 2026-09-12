import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { enqueueLeadWhatsAppAcknowledgement, type LeadWhatsAppEnqueueInput } from "./dispatch";
import type { PrismaClientLike } from "@/lib/repositories/server/prisma";

const input: LeadWhatsAppEnqueueInput = {
  leadId: "lead_1",
  organizationId: "org_1",
  whatsappOptIn: true,
  whatsappOptInText: "Please send one acknowledgement about this enquiry.",
  consentClass: "first-party-form",
  expiresAt: new Date("2026-09-12T00:00:00.000Z"),
};

function fakeClient(overrides: { subscription?: unknown; template?: unknown; account?: unknown; create?: (args: unknown) => Promise<unknown> } = {}) {
  const create = vi.fn(overrides.create ?? (async () => ({ id: "dispatch_1" })));
  const client = {
    marketplaceSubscription: { findFirst: vi.fn(async () => overrides.subscription ?? { id: "sub_1", status: "ACTIVE" }) },
    whatsappTemplate: { findFirst: vi.fn(async () => overrides.template ?? { id: "template_1", version: 1 }) },
    whatsappAccount: { findUnique: vi.fn(async () => overrides.account ?? { id: "account_1", status: "CONNECTED" }) },
    whatsappDispatch: { create },
  } as unknown as PrismaClientLike;
  return { client, create };
}

describe("lead WhatsApp dispatch enqueue", () => {
  it("records a permanent opt-in skip without touching the provider", async () => {
    const { client, create } = fakeClient();
    await enqueueLeadWhatsAppAcknowledgement(client, { ...input, whatsappOptIn: false });
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "SKIPPED", skipReason: "NO_WHATSAPP_OPT_IN" }) }));
  });

  it("requires opt-in evidence text before a row can be queued", async () => {
    const { client, create } = fakeClient();
    await enqueueLeadWhatsAppAcknowledgement(client, { ...input, whatsappOptInText: "" });
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "SKIPPED", skipReason: "NO_WHATSAPP_OPT_IN" }) }));
  });

  it("requires literal ACTIVE subscription status and queues only eligible leads", async () => {
    const { client, create } = fakeClient({ subscription: { id: "sub_1", status: "TRIAL" } });
    await enqueueLeadWhatsAppAcknowledgement(client, input);
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "SKIPPED", skipReason: "NO_ACTIVE_PLAN" }) }));

    const eligible = fakeClient();
    await enqueueLeadWhatsAppAcknowledgement(eligible.client, input);
    expect(eligible.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "PENDING", accountId: "account_1", templateId: "template_1", templateVersion: 1 }) }));
    const data = (eligible.create.mock.calls[0]?.[0] as { data?: Record<string, unknown> } | undefined)?.data ?? {};
    expect(data).not.toHaveProperty("phone");
    expect(data).not.toHaveProperty("body");
  });

  it("does not fail the lead transaction when the unique dispatch race is won elsewhere", async () => {
    const { client } = fakeClient({ create: async () => { throw { code: "P2002" }; } });
    await expect(enqueueLeadWhatsAppAcknowledgement(client, input)).resolves.toBeUndefined();
  });

  it("keeps a temporary account pending but skips a disconnected account", async () => {
    const pending = fakeClient({ account: { id: "account_1", status: "QR_READY" } });
    await enqueueLeadWhatsAppAcknowledgement(pending.client, input);
    expect(pending.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "PENDING" }) }));

    const disconnected = fakeClient({ account: { id: "account_1", status: "DISCONNECTED" } });
    await enqueueLeadWhatsAppAcknowledgement(disconnected.client, input);
    expect(disconnected.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "SKIPPED", skipReason: "NO_CONNECTED_ACCOUNT" }) }));
  });
});
