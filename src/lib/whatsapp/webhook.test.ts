import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => {
  const database = {
    $transaction: vi.fn(),
    $executeRawUnsafe: vi.fn(async () => 0),
    brokerOrganization: { findMany: vi.fn() },
    whatsappAccount: { findUnique: vi.fn(), update: vi.fn() },
    whatsappDispatch: { findFirst: vi.fn(), updateMany: vi.fn() },
    interopInboundEvent: { create: vi.fn() },
    auditEvent: { create: vi.fn() },
  };
  database.$transaction.mockImplementation(async (work: (tx: typeof database) => Promise<unknown>) => work(database));
  return { database };
});

vi.mock("@/lib/repositories/server/prisma", () => ({ getPrismaClient: () => mocks.database }));

import { EVOLUTION_WEBHOOK_MAX_BYTES, EvolutionWebhookError, applyEvolutionWebhookEvent, verifyEvolutionWebhookRequest } from "./webhook";

function token(secret: string, payload: Record<string, unknown> = {}, algorithm = "HS256") {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const header = encode({ alg: algorithm, typ: "JWT" });
  const body = encode({ iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 600, ...payload });
  const signature = createHmac("sha256", secret).update(`${header}.${body}`).digest("base64url");
  return `Bearer ${header}.${body}.${signature}`;
}

const body = JSON.stringify({ event: "CONNECTION_UPDATE", instance: "wa_a", id: "event_1", data: { state: "open" }, apikey: "DO_NOT_RETURN" });

beforeEach(() => {
  vi.stubEnv("ARCHITECH_EVOLUTION_WEBHOOK_JWT_KEY", "jwt-secret");
  vi.clearAllMocks();
  mocks.database.brokerOrganization.findMany.mockResolvedValue([{ id: "org_a" }, { id: "org_b" }]);
  mocks.database.whatsappAccount.findUnique.mockImplementation(async (args: { where: { instanceName?: string } }) => args.where.instanceName === "wa_a" ? { id: "account_a", organizationId: "org_a" } : null);
  mocks.database.whatsappAccount.update.mockResolvedValue({ id: "account_a" });
  mocks.database.whatsappDispatch.findFirst.mockResolvedValue({ id: "dispatch_a", status: "UNKNOWN", attemptCount: 1 });
  mocks.database.whatsappDispatch.updateMany.mockResolvedValue({ count: 1 });
  mocks.database.interopInboundEvent.create.mockResolvedValue({ id: "inbound_1" });
  mocks.database.auditEvent.create.mockResolvedValue({ id: "audit_1" });
});

describe("Evolution webhook verification", () => {
  it("verifies HS256 over the exact raw JWT bytes and reduces only safe event fields", () => {
    const event = verifyEvolutionWebhookRequest(body, token("jwt-secret"));
    expect(event).toEqual({ eventType: "CONNECTION_UPDATE", instanceName: "wa_a", externalId: "event_1", connectionState: "open" });
    expect(event).not.toHaveProperty("apikey");
  });

  it("rejects missing/malformed, wrong algorithm, bad signature, expired tokens, and oversized bodies", () => {
    expect(() => verifyEvolutionWebhookRequest(body, null)).toThrowError(new EvolutionWebhookError("AUTH", "WEBHOOK_AUTH_REQUIRED"));
    expect(() => verifyEvolutionWebhookRequest(body, "Basic secret")).toThrow(EvolutionWebhookError);
    expect(() => verifyEvolutionWebhookRequest(body, token("jwt-secret", { exp: Math.floor(Date.now() / 1000) - 1 }))).toThrow(/WEBHOOK_TOKEN_EXPIRED/);
    expect(() => verifyEvolutionWebhookRequest(body, token("wrong-secret"))).toThrow(/WEBHOOK_SIGNATURE_INVALID/);
    const badAlgorithm = token("jwt-secret", {}, "HS512");
    expect(() => verifyEvolutionWebhookRequest(body, badAlgorithm)).toThrow(/WEBHOOK_ALGORITHM_INVALID/);
    expect(() => verifyEvolutionWebhookRequest("x".repeat(EVOLUTION_WEBHOOK_MAX_BYTES + 1), token("jwt-secret"))).toThrow(/WEBHOOK_BODY_TOO_LARGE/);
  });

  it("rejects malformed JSON/identity, requires send ids, and ignores unsupported events safely", () => {
    expect(() => verifyEvolutionWebhookRequest("not-json", token("jwt-secret"))).toThrow(/WEBHOOK_JSON_INVALID/);
    expect(() => verifyEvolutionWebhookRequest(JSON.stringify({ event: "CONNECTION_UPDATE", data: {} }), token("jwt-secret"))).toThrow(/WEBHOOK_INSTANCE_INVALID/);
    expect(() => verifyEvolutionWebhookRequest(JSON.stringify({ event: "SEND_MESSAGE", instance: "wa_a", data: {} }), token("jwt-secret"))).toThrow(/WEBHOOK_MESSAGE_ID_MISSING/);
    expect(() => verifyEvolutionWebhookRequest(JSON.stringify({ event: "MESSAGES_UPSERT", instance: "wa_a", data: {} }), token("jwt-secret"))).toThrow(/WEBHOOK_EVENT_IGNORED/);
  });
});

describe("tenant-scoped Evolution webhook application", () => {
  it("maps connection events and deduplicates a verified external id", async () => {
    await applyEvolutionWebhookEvent(verifyEvolutionWebhookRequest(body, token("jwt-secret")));
    expect(mocks.database.whatsappAccount.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "account_a" }, data: expect.objectContaining({ status: "CONNECTED" }) }));
    expect(mocks.database.interopInboundEvent.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ provider: "evolution", organizationId: "org_a", externalId: "event_1" }) }));

    mocks.database.interopInboundEvent.create.mockRejectedValueOnce({ code: "P2002" });
    await expect(applyEvolutionWebhookEvent(verifyEvolutionWebhookRequest(body, token("jwt-secret")))).resolves.toBeUndefined();
    expect(mocks.database.whatsappAccount.update).toHaveBeenCalledTimes(1);
  });

  it("updates only a matching tenant dispatch and rejects unknown/cross-organization identities", async () => {
    const sendBody = JSON.stringify({ event: "SEND_MESSAGE_UPDATE", instance: "wa_a", id: "event_send_1", data: { status: "SERVER_ACK", key: { id: "message_a" } } });
    await applyEvolutionWebhookEvent(verifyEvolutionWebhookRequest(sendBody, token("jwt-secret")));
    expect(mocks.database.whatsappDispatch.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ accountId: "account_a", providerMessageId: "message_a" }), data: expect.objectContaining({ status: "ACCEPTED" }) }));

    mocks.database.whatsappDispatch.findFirst.mockResolvedValueOnce(null);
    await expect(applyEvolutionWebhookEvent(verifyEvolutionWebhookRequest(JSON.stringify({ event: "SEND_MESSAGE", instance: "wa_a", data: { key: { id: "foreign_message" } } }), token("jwt-secret")))).rejects.toThrow(/WEBHOOK_MESSAGE_UNKNOWN/);
    expect(mocks.database.whatsappDispatch.updateMany).toHaveBeenCalledTimes(1);

    await expect(applyEvolutionWebhookEvent(verifyEvolutionWebhookRequest(JSON.stringify({ event: "CONNECTION_UPDATE", instance: "wa_missing", data: { state: "open" } }), token("jwt-secret")))).rejects.toThrow(/WEBHOOK_INSTANCE_UNKNOWN/);
  });
});
