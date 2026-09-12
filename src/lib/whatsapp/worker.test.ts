import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => {
  const database = {
    $transaction: vi.fn(),
    $executeRawUnsafe: vi.fn(async () => 0),
    whatsappDispatch: { findMany: vi.fn(), findUnique: vi.fn(), findFirst: vi.fn(), updateMany: vi.fn() },
    whatsappAccount: { findUnique: vi.fn() },
    auditEvent: { create: vi.fn(async () => ({ id: "audit_1" })) },
    brokerOrganization: { findMany: vi.fn() },
  };
  database.$transaction.mockImplementation(async (work: (tx: typeof database) => Promise<unknown>) => work(database));
  return {
    database,
    decrypt: vi.fn(() => "+919876543210"),
    gate: vi.fn(async () => ({ ok: true, status: "ACTIVE" as const })),
    provider: { sendText: vi.fn(async () => ({ providerMessageId: "message_1" })) },
  };
});

vi.mock("@/lib/leads/source", () => ({ isPrismaLeadStorage: () => true }));
vi.mock("@/lib/repositories/server/prisma", () => ({ getPrismaClient: () => mocks.database }));
vi.mock("@/lib/interop/contact-crypto", () => ({ decryptContact: mocks.decrypt }));
vi.mock("./access", () => ({ resolveWhatsAppPlanGate: mocks.gate }));
vi.mock("./evolution", () => ({ getEvolutionProvider: () => mocks.provider }));

import { WhatsAppProviderError } from "./provider";
import { processWhatsAppDispatchBatch } from "./worker";

const baseRow = () => ({
  id: "dispatch_1",
  organizationId: "org_1",
  leadId: "lead_1",
  accountId: "account_1",
  templateId: "template_1",
  templateVersion: 1,
  status: "PENDING",
  attemptCount: 0,
  expiresAt: new Date("2026-09-12T00:15:00.000Z"),
  updatedAt: new Date("2026-09-12T00:00:00.000Z"),
  lead: {
    id: "lead_1",
    organizationId: "org_1",
    deletedAt: null,
    retentionUntil: new Date("2026-12-12T00:00:00.000Z"),
    whatsappOptIn: true,
    whatsappOptInText: "Please send one acknowledgement.",
    consentClass: "first-party-form",
    phoneCiphertext: Buffer.from("ciphertext"),
    name: "Asha Buyer",
    listing: { title: "Garden Court", city: { name: "Ahmedabad" } },
  },
  account: { id: "account_1", organizationId: "org_1", instanceName: "wa_random", status: "CONNECTED" },
  template: { id: "template_1", organizationId: "org_1", version: 1, body: "Hi {{firstName}} from {{brokerName}}" },
  organization: { id: "org_1", name: "Nivasa Partners" },
});

function setup(rowOverrides: Record<string, unknown> = {}) {
  let status = "PENDING";
  let attemptCount = 0;
  const row = { ...baseRow(), ...rowOverrides } as ReturnType<typeof baseRow>;
  mocks.database.whatsappDispatch.findMany.mockImplementation(async (args: { where?: { status?: string } }) => {
    if (args.where?.status === "IN_FLIGHT") return [];
    if (args.where?.status === "PENDING" && status === "PENDING") return [{ id: row.id, attemptCount, expiresAt: row.expiresAt }];
    return [];
  });
  mocks.database.whatsappDispatch.findUnique.mockImplementation(async () => ({ ...row, status, attemptCount }));
  mocks.database.whatsappDispatch.updateMany.mockImplementation(async (args: { where?: { status?: string }; data?: Record<string, unknown> }) => {
    const next = args.data?.status;
    if (next === "IN_FLIGHT" && args.where?.status === "PENDING" && status === "PENDING") {
      const lead = row.lead;
      const retentionUntil = lead && lead.retentionUntil instanceof Date ? lead.retentionUntil.getTime() : Number.POSITIVE_INFINITY;
      if (lead?.deletedAt || retentionUntil <= new Date("2026-09-12T00:01:00.000Z").getTime()) return { count: 0 };
      status = "IN_FLIGHT";
      attemptCount += 1;
      return { count: 1 };
    }
    if (args.where?.status === status && typeof next === "string") {
      status = next;
      return { count: 1 };
    }
    return { count: 0 };
  });
  return { row, status: () => status };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.gate.mockResolvedValue({ ok: true, status: "ACTIVE" });
  mocks.decrypt.mockReturnValue("+919876543210");
  mocks.provider.sendText.mockResolvedValue({ providerMessageId: "message_1" });
});

describe("WhatsApp dispatch worker", () => {
  it("claims an eligible row once, renders the pinned template, and accepts it", async () => {
    setup();
    const result = await processWhatsAppDispatchBatch({ organizationId: "org_1", now: new Date("2026-09-12T00:01:00.000Z") });
    expect(result).toMatchObject({ scanned: 1, claimed: 1, accepted: 1, failed: 0, unknown: 0 });
    expect(mocks.provider.sendText).toHaveBeenCalledWith({ instanceName: "wa_random", number: "919876543210", text: "Hi Asha from Nivasa Partners" });
    expect(mocks.decrypt).toHaveBeenCalledTimes(1);

    const replay = await processWhatsAppDispatchBatch({ organizationId: "org_1", now: new Date("2026-09-12T00:02:00.000Z") });
    expect(replay.scanned).toBe(0);
    expect(mocks.provider.sendText).toHaveBeenCalledTimes(1);
  });

  it("marks definitive provider errors failed and ambiguous errors unknown without resend", async () => {
    setup();
    mocks.provider.sendText.mockRejectedValueOnce(new WhatsAppProviderError("DEFINITIVE", "PROVIDER_REJECTED"));
    const failed = await processWhatsAppDispatchBatch({ organizationId: "org_1", now: new Date("2026-09-12T00:01:00.000Z") });
    expect(failed.failed).toBe(1);

    setup();
    mocks.provider.sendText.mockClear();
    mocks.provider.sendText.mockRejectedValueOnce(new WhatsAppProviderError("AMBIGUOUS", "PROVIDER_TIMEOUT"));
    const unknown = await processWhatsAppDispatchBatch({ organizationId: "org_1", now: new Date("2026-09-12T00:01:00.000Z") });
    expect(unknown.unknown).toBe(1);
    const replay = await processWhatsAppDispatchBatch({ organizationId: "org_1", now: new Date("2026-09-12T00:02:00.000Z") });
    expect(replay.scanned).toBe(0);
    expect(mocks.provider.sendText).toHaveBeenCalledTimes(1);
  });

  it("does not decrypt or send for opt-out, deleted, expired, or disconnected leads", async () => {
    for (const override of [
      { lead: { ...baseRow().lead, whatsappOptIn: false } },
      { lead: { ...baseRow().lead, deletedAt: new Date("2026-09-11T00:00:00.000Z") } },
      { lead: { ...baseRow().lead, retentionUntil: new Date("2026-09-11T00:00:00.000Z") } },
      { account: { ...baseRow().account, status: "DISCONNECTED" } },
    ]) {
      setup(override);
      const result = await processWhatsAppDispatchBatch({ organizationId: "org_1", now: new Date("2026-09-12T00:01:00.000Z") });
      const lead = override.lead as { whatsappOptIn?: boolean; deletedAt?: unknown; retentionUntil?: unknown } | undefined;
      expect(result.skipped).toBe(lead?.deletedAt || lead?.retentionUntil instanceof Date && lead.retentionUntil.getTime() <= new Date("2026-09-12T00:01:00.000Z").getTime() ? 0 : 1);
      expect(mocks.decrypt).not.toHaveBeenCalled();
      expect(mocks.provider.sendText).not.toHaveBeenCalled();
      vi.clearAllMocks();
      mocks.gate.mockResolvedValue({ ok: true, status: "ACTIVE" });
    }
  });

  it("keeps a QR/connecting account pending and records no provider call", async () => {
    const state = setup({ account: { ...baseRow().account, status: "QR_READY" } });
    const result = await processWhatsAppDispatchBatch({ organizationId: "org_1", now: new Date("2026-09-12T00:01:00.000Z") });
    expect(result.pending).toBe(1);
    expect(state.status()).toBe("PENDING");
    expect(mocks.provider.sendText).not.toHaveBeenCalled();
  });

  it("skips a non-active plan and a foreign row before contact decryption", async () => {
    setup();
    mocks.gate.mockImplementation(async () => ({ ok: false, status: 402, reason: "NO_ACTIVE_PLAN" } as never));
    const result = await processWhatsAppDispatchBatch({ organizationId: "org_1", now: new Date("2026-09-12T00:01:00.000Z") });
    expect(result.skipped).toBe(1);
    expect(mocks.decrypt).not.toHaveBeenCalled();

    setup({ organizationId: "org_other" });
    const foreign = await processWhatsAppDispatchBatch({ organizationId: "org_1", now: new Date("2026-09-12T00:01:00.000Z") });
    expect(foreign.claimed).toBe(1);
    expect(foreign.skipped).toBe(0);
    expect(mocks.decrypt).not.toHaveBeenCalled();
  });
});
