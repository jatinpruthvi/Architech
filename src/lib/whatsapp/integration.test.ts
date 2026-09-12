import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaClientLike } from "@/lib/repositories/server/prisma";

vi.mock("server-only", () => ({}));

type FixtureRecord = Record<string, unknown>;
type LeadFixture = {
  id: string;
  organizationId: string;
  deletedAt: Date | null;
  retentionUntil: Date;
  whatsappOptIn: boolean;
  whatsappOptInText: string;
  consentClass: string;
  phoneCiphertext: Buffer;
  name: string;
  listing: { title: string; city: { name: string } };
};
type AccountFixture = { id: string; organizationId: string; instanceName: string; status: string };
type TemplateFixture = { id: string; organizationId: string; version: number; body: string };
type DispatchFixture = FixtureRecord & {
  id: string;
  organizationId: string;
  leadId: string;
  accountId: string | null;
  templateId: string | null;
  purpose: string;
  status: string;
  attemptCount: number;
  expiresAt: Date;
  updatedAt: Date;
  lead: LeadFixture;
  account: AccountFixture | null;
  template: TemplateFixture | null;
  organization: { id: string; name: string };
};
type DispatchData = FixtureRecord & {
  organizationId: string;
  leadId: string;
  purpose: string;
  accountId?: string | null;
  templateId?: string | null;
  status?: string;
  attemptCount?: { increment?: number };
};
type DispatchWhere = {
  id?: string;
  organizationId?: string;
  status?: string | { in?: string[] };
  lead?: { is?: unknown };
};

const mocks = vi.hoisted(() => {
  const rows: DispatchFixture[] = [];
  const leads = new Map<string, LeadFixture>();
  const accounts = new Map<string, AccountFixture>();
  const templates = new Map<string, TemplateFixture>();
  const database = {
    $transaction: vi.fn(),
    $executeRawUnsafe: vi.fn(async () => 0),
    marketplaceSubscription: { findFirst: vi.fn() },
    whatsappAccount: { findUnique: vi.fn() },
    whatsappTemplate: { findFirst: vi.fn() },
    whatsappDispatch: { create: vi.fn(), findMany: vi.fn(), findUnique: vi.fn(), updateMany: vi.fn() },
    auditEvent: { create: vi.fn() },
    brokerOrganization: { findMany: vi.fn() },
  };
  const provider = { sendText: vi.fn() };
  return { rows, leads, accounts, templates, database, provider, gate: vi.fn() };
});

vi.mock("@/lib/leads/source", () => ({ isPrismaLeadStorage: () => true }));
vi.mock("@/lib/repositories/server/prisma", () => ({ getPrismaClient: () => mocks.database }));
vi.mock("@/lib/interop/contact-crypto", () => ({ decryptContact: vi.fn(() => "+919876543210") }));
vi.mock("./access", () => ({ resolveWhatsAppPlanGate: mocks.gate }));
vi.mock("./evolution", () => ({ getEvolutionProvider: () => mocks.provider }));

import { enqueueLeadWhatsAppAcknowledgement } from "./dispatch";
import { WhatsAppProviderError } from "./provider";
import { processWhatsAppDispatchBatch } from "./worker";

const now = new Date("2026-09-12T00:01:00.000Z");

function resetState() {
  mocks.rows.length = 0;
  mocks.leads.clear();
  mocks.accounts.clear();
  mocks.templates.clear();
  mocks.database.$transaction.mockImplementation(async (work: (tx: typeof mocks.database) => Promise<unknown>) => work(mocks.database));
  mocks.database.marketplaceSubscription.findFirst.mockResolvedValue({ id: "sub_active", status: "ACTIVE" });
  mocks.database.whatsappAccount.findUnique.mockImplementation(async (args: { where: { organizationId?: string } }) => mocks.accounts.get(args.where.organizationId ?? "") ?? null);
  mocks.database.whatsappTemplate.findFirst.mockImplementation(async (args: { where: { organizationId?: string } }) => mocks.templates.get(args.where.organizationId ?? "") ?? null);
  mocks.database.whatsappDispatch.create.mockImplementation(async (args: { data: DispatchData }) => {
    if (mocks.rows.some((row) => row.leadId === args.data.leadId && row.purpose === args.data.purpose)) throw { code: "P2002" };
    const account = typeof args.data.accountId === "string" ? [...mocks.accounts.values()].find((candidate) => candidate.id === args.data.accountId) ?? null : null;
    const template = typeof args.data.templateId === "string" ? [...mocks.templates.values()].find((candidate) => candidate.id === args.data.templateId) ?? null : null;
    const lead = mocks.leads.get(args.data.leadId);
    if (!lead) throw new Error("lead fixture missing");
    const row: DispatchFixture = {
      id: `dispatch_${mocks.rows.length + 1}`,
      ...args.data,
      accountId: args.data.accountId ?? null,
      templateId: args.data.templateId ?? null,
      purpose: args.data.purpose,
      status: args.data.status ?? "PENDING",
      attemptCount: 0,
      expiresAt: new Date("2026-09-12T00:15:00.000Z"),
      updatedAt: now,
      lead,
      account,
      template,
      organization: { id: args.data.organizationId, name: args.data.organizationId === "org_a" ? "Broker A" : "Broker B" },
    };
    mocks.rows.push(row);
    return row;
  });
  mocks.database.whatsappDispatch.findMany.mockImplementation(async (args: { where: { organizationId: string; status: string } }) => {
    if (args.where.status === "IN_FLIGHT") return [];
    return mocks.rows.filter((row) => row.organizationId === args.where.organizationId && row.status === "PENDING").map((row) => ({ id: row.id, attemptCount: row.attemptCount, expiresAt: row.expiresAt }));
  });
  mocks.database.whatsappDispatch.findUnique.mockImplementation(async (args: { where: { id: string } }) => mocks.rows.find((row) => row.id === args.where.id) ?? null);
  mocks.database.whatsappDispatch.updateMany.mockImplementation(async (args: { where: DispatchWhere; data: DispatchData }) => {
    const row = mocks.rows.find((candidate) => candidate.id === args.where.id && candidate.organizationId === args.where.organizationId);
    if (!row) return { count: 0 };
    const statusFilter = args.where.status;
    const statusMatches = typeof statusFilter === "string"
      ? row.status === statusFilter
      : Boolean(statusFilter?.in?.includes(row.status));
    if (!statusMatches) return { count: 0 };
    if (args.where.lead?.is && (row.lead.deletedAt || row.lead.retentionUntil <= now)) return { count: 0 };
    if (typeof args.data.status === "string") row.status = args.data.status;
    const attemptCount = args.data.attemptCount;
    if (attemptCount?.increment) row.attemptCount += attemptCount.increment;
    for (const [key, value] of Object.entries(args.data)) if (key !== "status" && key !== "attemptCount") row[key] = value;
    return { count: 1 };
  });
  mocks.database.auditEvent.create.mockResolvedValue({ id: "audit_1" });
  mocks.gate.mockResolvedValue({ ok: true, status: "ACTIVE" });
  mocks.provider.sendText.mockReset();
  mocks.provider.sendText.mockResolvedValue({ providerMessageId: "provider_message" });
}

function configureOrganization(organizationId: string) {
  mocks.accounts.set(organizationId, { id: `account_${organizationId}`, organizationId, instanceName: `wa_${organizationId}`, status: "CONNECTED" });
  mocks.templates.set(organizationId, { id: `template_${organizationId}_v1`, organizationId, version: 1, body: "Hi {{firstName}} from {{brokerName}} v1" });
}

async function createLead(organizationId: string, leadId: string, name = "Asha Buyer") {
  const lead: LeadFixture = {
    id: leadId,
    organizationId,
    deletedAt: null,
    retentionUntil: new Date("2026-12-12T00:00:00.000Z"),
    whatsappOptIn: true,
    whatsappOptInText: "Please send one acknowledgement.",
    consentClass: "first-party-form",
    phoneCiphertext: Buffer.from("ciphertext"),
    name,
    listing: { title: organizationId === "org_a" ? "Garden Court" : "River View", city: { name: organizationId === "org_a" ? "Ahmedabad" : "Surat" } },
  };
  mocks.leads.set(leadId, lead);
  await enqueueLeadWhatsAppAcknowledgement(mocks.database as unknown as PrismaClientLike, { leadId, organizationId, whatsappOptIn: true, whatsappOptInText: lead.whatsappOptInText, consentClass: lead.consentClass, expiresAt: new Date("2026-09-12T00:15:00.000Z") });
  return lead;
}

beforeEach(() => {
  vi.clearAllMocks();
  resetState();
  configureOrganization("org_a");
  configureOrganization("org_b");
});

describe("one-time WhatsApp vertical flow", () => {
  it("keeps both organizations isolated, claims a duplicate concurrently once, pins template v1, and never retries UNKNOWN", async () => {
    await createLead("org_a", "lead_a");
    await enqueueLeadWhatsAppAcknowledgement(mocks.database as unknown as PrismaClientLike, { leadId: "lead_a", organizationId: "org_a", whatsappOptIn: true, whatsappOptInText: "Please send one acknowledgement.", consentClass: "first-party-form", expiresAt: new Date("2026-09-12T00:15:00.000Z") });
    await createLead("org_b", "lead_b", "Bina Buyer");
    expect(mocks.rows).toHaveLength(2);

    const [first, second] = await Promise.all([
      processWhatsAppDispatchBatch({ organizationId: "org_a", now }),
      processWhatsAppDispatchBatch({ organizationId: "org_a", now }),
    ]);
    expect(first.accepted + second.accepted).toBe(1);
    expect(mocks.provider.sendText).toHaveBeenCalledTimes(1);
    expect(mocks.provider.sendText).toHaveBeenCalledWith(expect.objectContaining({ instanceName: "wa_org_a", number: "919876543210", text: "Hi Asha from Broker A v1" }));
    expect(mocks.rows.find((row) => row.leadId === "lead_a")?.status).toBe("ACCEPTED");

    const bResult = await processWhatsAppDispatchBatch({ organizationId: "org_b", now });
    expect(bResult.accepted).toBe(1);
    expect(mocks.provider.sendText).toHaveBeenCalledWith(expect.objectContaining({ instanceName: "wa_org_b", text: "Hi Bina from Broker B v1" }));
    expect(mocks.rows.every((row) => !Object.prototype.hasOwnProperty.call(row, "phone") && !Object.prototype.hasOwnProperty.call(row, "text"))).toBe(true);

    mocks.templates.set("org_a", { id: "template_org_a_v2", organizationId: "org_a", version: 2, body: "NEW {{firstName}}" });
    const acceptedAgain = await processWhatsAppDispatchBatch({ organizationId: "org_a", now: new Date("2026-09-12T00:02:00.000Z") });
    expect(acceptedAgain.scanned).toBe(0);
    expect(mocks.provider.sendText).toHaveBeenCalledTimes(2);

    const accountA = mocks.accounts.get("org_a");
    if (!accountA) throw new Error("org_a account fixture missing");
    accountA.status = "DISCONNECTED";
    await createLead("org_a", "lead_disconnected");
    expect(mocks.rows.find((row) => row.leadId === "lead_disconnected")?.status).toBe("SKIPPED");
    expect(mocks.provider.sendText).toHaveBeenCalledTimes(2);

    accountA.status = "CONNECTED";
    await createLead("org_a", "lead_unknown");
    mocks.provider.sendText.mockRejectedValueOnce(new WhatsAppProviderError("AMBIGUOUS", "PROVIDER_TIMEOUT"));
    const unknown = await processWhatsAppDispatchBatch({ organizationId: "org_a", now: new Date("2026-09-12T00:03:00.000Z") });
    expect(unknown.unknown).toBe(1);
    const replay = await processWhatsAppDispatchBatch({ organizationId: "org_a", now: new Date("2026-09-12T00:04:00.000Z") });
    expect(replay.scanned).toBe(0);
    expect(mocks.provider.sendText).toHaveBeenCalledTimes(3);
  });
});
