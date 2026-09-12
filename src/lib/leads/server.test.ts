import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => {
  const database = {
    listing: { findFirst: vi.fn() },
    lead: { findUnique: vi.fn(), create: vi.fn(), findMany: vi.fn(), update: vi.fn() },
    auditEvent: { create: vi.fn(), findMany: vi.fn() },
    $transaction: vi.fn(),
  };
  database.$transaction.mockImplementation(async (work: (tx: typeof database) => Promise<unknown>) => work(database));
  return { database, enqueue: vi.fn() };
});

vi.mock("@/lib/repositories/server/prisma", () => ({ getPrismaClient: () => mocks.database }));
vi.mock("@/lib/whatsapp/dispatch", () => ({ enqueueLeadWhatsAppAcknowledgement: mocks.enqueue }));

import { createLeadForServer } from "./server";

describe("Prisma lead WhatsApp enqueue seam", () => {
  beforeEach(() => {
    vi.stubEnv("ARCHITECH_LEAD_STORAGE", "prisma");
    vi.stubEnv("ARCHITECH_IDEMPOTENCY_HMAC_KEY", "test-lead-hmac-secret");
    vi.stubEnv("ARCHITECH_CONTACT_ENCRYPTION_KEY", "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=");
    vi.clearAllMocks();
    mocks.database.listing.findFirst.mockResolvedValue({ id: "listing-db-1", title: "A courtyard home", brokerOrgId: "org_1", brokerOrg: { name: "Broker One" } });
    mocks.database.lead.create.mockResolvedValue({ id: "lead-db-1", createdAt: new Date("2026-09-12T00:00:00.000Z") });
    mocks.database.auditEvent.create.mockResolvedValue({ id: "audit-db-1" });
    mocks.enqueue.mockResolvedValue(undefined);
  });

  it("enqueues once after the lead and audit rows exist, and never on a duplicate", async () => {
    mocks.database.lead.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "lead-db-1" });

    const input = {
      listingId: "listing-public-1",
      name: "Asha Buyer",
      phone: "+91 98765 43210",
      message: "Please share more details about this home.",
      consentText: "I consent to masked contact for this enquiry.",
      whatsappOptIn: true,
      whatsappOptInText: "Please send one acknowledgement about this enquiry.",
      idempotencyKey: "browser-retry-token",
    };

    const first = await createLeadForServer(input);
    expect(first.ok && first.duplicate).toBe(false);
    expect(mocks.enqueue).toHaveBeenCalledTimes(1);
    expect(mocks.enqueue.mock.invocationCallOrder[0]).toBeGreaterThan(mocks.database.auditEvent.create.mock.invocationCallOrder[0]);

    const replay = await createLeadForServer(input);
    expect(replay.ok && replay.duplicate).toBe(true);
    expect(mocks.enqueue).toHaveBeenCalledTimes(1);
  });

  it("persists default-off eligibility and never trusts a client capture timestamp", async () => {
    mocks.database.lead.findUnique.mockResolvedValue(null);
    const result = await createLeadForServer({
      listingId: "listing-public-1",
      name: "Asha Buyer",
      phone: "+91 98765 43210",
      message: "Please share more details about this home.",
      consentText: "I consent to masked contact for this enquiry.",
      whatsappOptInAt: "1999-01-01T00:00:00.000Z",
    });
    expect(result.ok).toBe(true);
    expect(mocks.database.lead.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ whatsappOptIn: false, whatsappOptInAt: null, whatsappOptInText: null }) }));
    expect(mocks.enqueue).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ whatsappOptIn: false, whatsappOptInText: null }));
  });
});
