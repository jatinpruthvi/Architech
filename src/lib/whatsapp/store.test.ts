import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => {
  const database = {
    $transaction: vi.fn(),
    $executeRawUnsafe: vi.fn(async () => 0),
    brokerOrganization: { update: vi.fn(async () => ({ id: "org_1" })) },
    whatsappAccount: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    whatsappTemplate: { findFirst: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
    whatsappDispatch: { findMany: vi.fn() },
    auditEvent: { create: vi.fn() },
  };
  database.$transaction.mockImplementation(async (work: (tx: typeof database) => Promise<unknown>) => work(database));
  return {
    database,
    plan: vi.fn(),
    gate: vi.fn(),
    provider: { createInstance: vi.fn(), getQr: vi.fn(), getConnectionState: vi.fn(), sendText: vi.fn() },
  };
});

vi.mock("@/lib/leads/source", () => ({ isPrismaLeadStorage: () => true }));
vi.mock("@/lib/repositories/server/prisma", () => ({ getPrismaClient: () => mocks.database }));
vi.mock("@/lib/plans/plan-status", () => ({ resolvePlanStatusForOrg: mocks.plan }));
vi.mock("./access", () => ({ resolveWhatsAppPlanGate: mocks.gate }));
vi.mock("./evolution", () => ({ getEvolutionProvider: () => mocks.provider }));

import { connectWhatsAppAccount, readWhatsAppQr, readWhatsAppSettings, refreshWhatsAppConnectionState, saveWhatsAppTemplate } from "./store";
import { WhatsAppProviderError } from "./provider";

beforeEach(() => {
  vi.stubEnv("ARCHITECH_EVOLUTION_WEBHOOK_URL", "https://architech.test/webhook");
  vi.stubEnv("ARCHITECH_EVOLUTION_WEBHOOK_JWT_KEY", "webhook-secret");
  vi.clearAllMocks();
  mocks.plan.mockResolvedValue("ACTIVE");
  mocks.gate.mockResolvedValue({ ok: true, status: "ACTIVE" });
  mocks.database.whatsappAccount.findUnique.mockResolvedValue({ id: "account_1", instanceName: "wa_random", status: "CONNECTED", phoneLast4: "3210", connectedAt: new Date("2026-09-12T00:00:00.000Z"), lastObservedAt: new Date("2026-09-12T00:01:00.000Z"), lastErrorCode: null });
  mocks.database.whatsappAccount.update.mockResolvedValue({ id: "account_1", instanceName: "wa_random", status: "CONNECTED", phoneLast4: "3210" });
  mocks.database.whatsappTemplate.findFirst.mockResolvedValue({ id: "template_2", version: 2, body: "Hi {{firstName}}", createdAt: new Date("2026-09-12T00:00:00.000Z") });
  mocks.database.whatsappTemplate.create.mockResolvedValue({ id: "template_new", version: 3, body: "Hi {{firstName}}" });
  mocks.database.whatsappTemplate.updateMany.mockResolvedValue({ count: 1 });
  mocks.database.whatsappDispatch.findMany.mockResolvedValue([
    { status: "ACCEPTED", providerMessageId: "message_1", acceptedAt: new Date("2026-09-12T00:02:00.000Z"), completedAt: new Date("2026-09-12T00:02:01.000Z"), createdAt: new Date("2026-09-12T00:02:00.000Z") },
    { status: "SKIPPED", providerMessageId: null, acceptedAt: null, completedAt: null, createdAt: new Date("2026-09-12T00:01:00.000Z") },
  ]);
  mocks.database.auditEvent.create.mockResolvedValue({ id: "audit_1" });
  mocks.provider.createInstance.mockResolvedValue({ providerInstanceId: "provider_1", state: "connecting" });
  mocks.provider.getQr.mockResolvedValue({ state: "connecting", qrDataUrl: "data:image/png;base64,qr" });
  mocks.provider.getConnectionState.mockResolvedValue({ state: "open" });
});

afterEach(() => vi.unstubAllEnvs());

describe("tenant-scoped WhatsApp store", () => {
  it("returns sanitized organization settings and delivery counts", async () => {
    const settings = await readWhatsAppSettings("org_1");
    expect(settings).toMatchObject({ enabled: true, plan: { status: "ACTIVE", eligible: true }, account: { status: "CONNECTED", phoneLast4: "3210" }, template: { id: "template_2", version: 2 }, delivery: { accepted: 1, skipped: 1 } });
    expect(settings.account).not.toHaveProperty("instanceName");
    expect(settings).not.toHaveProperty("providerInstanceId");
    expect(settings.delivery.latest).toEqual({ status: "ACCEPTED", providerMessageId: "message_1", acceptedAt: "2026-09-12T00:02:00.000Z", completedAt: "2026-09-12T00:02:01.000Z" });
    expect(mocks.database.$executeRawUnsafe).toHaveBeenCalledWith("SELECT set_config($1, $2, true)", "app.current_org_id", "org_1");
  });

  it("versions and deactivates templates in one tenant transaction", async () => {
    mocks.database.whatsappTemplate.findFirst.mockResolvedValueOnce({ id: "template_2", version: 2 });
    const result = await saveWhatsAppTemplate({ organizationId: "org_1", actorUserId: "user_1", body: "Hello {{firstName}}" });
    expect(result).toEqual({ ok: true, template: { id: "template_new", version: 3, body: "Hi {{firstName}}" } });
    expect(mocks.database.brokerOrganization.update).toHaveBeenCalled();
    expect(mocks.database.whatsappTemplate.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { organizationId: "org_1", isActive: true }, data: { isActive: false } }));
    expect(mocks.database.auditEvent.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: "whatsapp.template.updated", organizationId: "org_1", metadata: { version: 3 } }) }));
  });

  it("requires company ownership attestation and does not call Evolution when it is absent", async () => {
    const result = await connectWhatsAppAccount({ organizationId: "org_1", actorUserId: "user_1", companyOwnedAcknowledged: false });
    expect(result).toEqual({ ok: false, status: 400, reason: "COMPANY_OWNERSHIP_ACK_REQUIRED" });
    expect(mocks.provider.createInstance).not.toHaveBeenCalled();
  });

  it("creates/resumes one account and maps provider state without exposing instance names", async () => {
    mocks.database.whatsappAccount.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: "account_1", instanceName: "wa_random", status: "PROVISIONING" });
    mocks.database.whatsappTemplate.findFirst.mockResolvedValueOnce(null);
    mocks.database.whatsappAccount.create.mockResolvedValue({ id: "account_1", instanceName: "wa_random", status: "PROVISIONING" });
    const result = await connectWhatsAppAccount({ organizationId: "org_1", actorUserId: "user_1", companyOwnedAcknowledged: true });
    expect(result).toEqual({ ok: true, account: { status: "CONNECTING" }, seededTemplate: true });
    expect(mocks.provider.createInstance).toHaveBeenCalledWith(expect.objectContaining({ instanceName: "wa_random", webhookUrl: expect.any(String), webhookJwtKey: expect.any(String) }));
    expect(JSON.stringify(result)).not.toContain("wa_random");
  });

  it("recreates an instance only after Evolution definitively reports it missing", async () => {
    mocks.database.whatsappAccount.findUnique.mockResolvedValueOnce({ id: "account_1", instanceName: "wa_random", status: "ERROR" });
    mocks.database.whatsappTemplate.findFirst.mockResolvedValueOnce({ id: "template_2", version: 2, body: "Hi {{firstName}}" });
    mocks.provider.getConnectionState.mockRejectedValueOnce(new WhatsAppProviderError("DEFINITIVE", "INSTANCE_NOT_FOUND"));

    const result = await connectWhatsAppAccount({ organizationId: "org_1", actorUserId: "user_1", companyOwnedAcknowledged: true });

    expect(result).toEqual({ ok: true, account: { status: "CONNECTING" }, seededTemplate: false });
    expect(mocks.provider.createInstance).toHaveBeenCalledTimes(1);
  });

  it("returns QR only as a short-lived response and refreshes observed state", async () => {
    const qr = await readWhatsAppQr("org_1");
    expect(qr).toEqual({ state: "connecting", qrDataUrl: "data:image/png;base64,qr" });
    const status = await refreshWhatsAppConnectionState("org_1");
    expect(status.status).toBe("CONNECTED");
    expect(status.phoneLast4).toBe("3210");
  });
});
