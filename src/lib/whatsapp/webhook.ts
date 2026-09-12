import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { getPrismaClient, type PrismaClientLike, type PrismaModelDelegate } from "@/lib/repositories/server/prisma";
import { withTenantPrisma, type PrismaTenantClient } from "@/lib/repositories/server/tenant";

export const EVOLUTION_WEBHOOK_MAX_BYTES = 128 * 1024;
const SAFE_ID = /^[A-Za-z0-9._:-]{1,140}$/;
const ALLOWED_EVENTS = ["QRCODE_UPDATED", "CONNECTION_UPDATE", "SEND_MESSAGE", "SEND_MESSAGE_UPDATE"] as const;

type EventType = (typeof ALLOWED_EVENTS)[number];
type JsonRecord = Record<string, unknown>;

export type EvolutionWebhookEvent = {
  externalId?: string;
  eventType: EventType;
  instanceName: string;
  providerMessageId?: string;
  connectionState?: string;
};

export class EvolutionWebhookError extends Error {
  constructor(readonly kind: "AUTH" | "BAD_REQUEST" | "TOO_LARGE" | "UNSUPPORTED", readonly code: string) {
    super(code);
    this.name = "EvolutionWebhookError";
  }
}

type WebhookClient = PrismaClientLike & {
  whatsappAccount: PrismaModelDelegate;
  whatsappDispatch: PrismaModelDelegate;
  interopInboundEvent: PrismaModelDelegate;
  auditEvent: PrismaModelDelegate;
};

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function safeId(value: unknown): string | undefined {
  return typeof value === "string" && SAFE_ID.test(value) ? value : undefined;
}

function safeState(value: unknown): string | undefined {
  return typeof value === "string" && /^[A-Za-z0-9._:-]{1,64}$/.test(value) ? value : undefined;
}

function base64UrlDecode(value: string): Buffer {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new EvolutionWebhookError("AUTH", "WEBHOOK_TOKEN_INVALID");
  return Buffer.from(value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "="), "base64");
}

function parseToken(authorization: string | null): { encodedHeader: string; encodedPayload: string; signature: string } {
  if (!authorization) throw new EvolutionWebhookError("AUTH", "WEBHOOK_AUTH_REQUIRED");
  const match = /^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/.exec(authorization.trim());
  if (!match) throw new EvolutionWebhookError("AUTH", "WEBHOOK_AUTH_INVALID");
  const [encodedHeader, encodedPayload, signature] = match[1].split(".");
  return { encodedHeader, encodedPayload, signature };
}

function verifyJwt(rawBody: string, authorization: string | null): void {
  void rawBody;
  const secret = process.env.ARCHITECH_EVOLUTION_WEBHOOK_JWT_KEY?.trim();
  if (!secret) throw new EvolutionWebhookError("AUTH", "WEBHOOK_NOT_CONFIGURED");
  const token = parseToken(authorization);
  let header: unknown;
  let payload: unknown;
  try {
    header = JSON.parse(base64UrlDecode(token.encodedHeader).toString("utf8"));
    payload = JSON.parse(base64UrlDecode(token.encodedPayload).toString("utf8"));
  } catch {
    throw new EvolutionWebhookError("AUTH", "WEBHOOK_TOKEN_INVALID");
  }
  if (!isRecord(header) || header.alg !== "HS256" || !isRecord(payload)) throw new EvolutionWebhookError("AUTH", "WEBHOOK_ALGORITHM_INVALID");
  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== "number" || payload.exp <= now || typeof payload.iat !== "number" || payload.iat < now - 900 || payload.iat > now + 60) {
    throw new EvolutionWebhookError("AUTH", "WEBHOOK_TOKEN_EXPIRED");
  }
  const expected = createHmac("sha256", secret).update(`${token.encodedHeader}.${token.encodedPayload}`).digest();
  const actual = base64UrlDecode(token.signature);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new EvolutionWebhookError("AUTH", "WEBHOOK_SIGNATURE_INVALID");
}

function eventData(body: JsonRecord): JsonRecord {
  return isRecord(body.data) ? body.data : {};
}

function providerMessageId(body: JsonRecord, data: JsonRecord): string | undefined {
  const dataKey = isRecord(data.key) ? data.key : {};
  const message = isRecord(data.message) ? data.message : {};
  const messageKey = isRecord(message.key) ? message.key : {};
  return safeId(data.messageId ?? data.id ?? dataKey.id ?? messageKey.id ?? body.messageId);
}

/** Verify the exact raw body and reduce a provider payload to safe state facts. */
export function verifyEvolutionWebhookRequest(rawBody: string, authorization: string | null): EvolutionWebhookEvent {
  if (Buffer.byteLength(rawBody, "utf8") > EVOLUTION_WEBHOOK_MAX_BYTES) throw new EvolutionWebhookError("TOO_LARGE", "WEBHOOK_BODY_TOO_LARGE");
  verifyJwt(rawBody, authorization);
  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    throw new EvolutionWebhookError("BAD_REQUEST", "WEBHOOK_JSON_INVALID");
  }
  if (!isRecord(body)) throw new EvolutionWebhookError("BAD_REQUEST", "WEBHOOK_SHAPE_INVALID");
  const event = body.event;
  const instanceName = safeId(body.instance ?? body.instanceName);
  if (typeof event !== "string" || !ALLOWED_EVENTS.includes(event as EventType)) throw new EvolutionWebhookError("UNSUPPORTED", "WEBHOOK_EVENT_IGNORED");
  if (!instanceName) throw new EvolutionWebhookError("BAD_REQUEST", "WEBHOOK_INSTANCE_INVALID");
  const data = eventData(body);
  const messageId = providerMessageId(body, data);
  const externalId = safeId(body.id ?? body.eventId ?? data.eventId ?? data.id) ?? (event === "SEND_MESSAGE" || event === "SEND_MESSAGE_UPDATE" ? messageId : undefined);
  if ((event === "SEND_MESSAGE" || event === "SEND_MESSAGE_UPDATE") && !messageId) throw new EvolutionWebhookError("BAD_REQUEST", "WEBHOOK_MESSAGE_ID_MISSING");
  const connectionState = event === "QRCODE_UPDATED"
    ? "QR_READY"
    : safeState(data.state ?? data.status ?? body.state ?? body.status);
  return {
    ...(externalId ? { externalId } : {}),
    eventType: event as EventType,
    instanceName,
    ...(messageId ? { providerMessageId: messageId } : {}),
    ...(connectionState ? { connectionState } : {}),
  };
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: unknown }).code === "P2002";
}

function mappedAccountState(event: EvolutionWebhookEvent): "QR_READY" | "CONNECTING" | "CONNECTED" | "DISCONNECTED" | "ERROR" {
  if (event.eventType === "QRCODE_UPDATED") return "QR_READY";
  const state = (event.connectionState ?? "").toLowerCase();
  if (["open", "connected", "online"].includes(state)) return "CONNECTED";
  if (["connecting", "opening"].includes(state)) return "CONNECTING";
  if (["close", "closed", "disconnected", "logout"].includes(state)) return "DISCONNECTED";
  if (["error", "failed"].includes(state)) return "ERROR";
  return "CONNECTING";
}

function isFailedSend(event: EvolutionWebhookEvent): boolean {
  return event.eventType === "SEND_MESSAGE_UPDATE" && ["error", "failed", "failure"].includes((event.connectionState ?? "").toLowerCase());
}

async function applyInTenant(tx: WebhookClient, organizationId: string, account: { id: string; organizationId?: string | null }, event: EvolutionWebhookEvent): Promise<void> {
  if (account.organizationId !== organizationId) throw new EvolutionWebhookError("BAD_REQUEST", "WEBHOOK_SCOPE_MISMATCH");
  if (event.eventType === "QRCODE_UPDATED" || event.eventType === "CONNECTION_UPDATE") {
    const status = mappedAccountState(event);
    await tx.whatsappAccount.update({ where: { id: account.id }, data: { status, lastObservedAt: new Date() } });
    await tx.auditEvent.create({ data: { organizationId, action: "whatsapp.provider.event", entityType: "WhatsAppAccount", entityId: account.id, metadata: { eventType: event.eventType, status, ...(event.externalId ? { externalId: event.externalId } : {}) } } });
    return;
  }

  if (!event.providerMessageId) throw new EvolutionWebhookError("BAD_REQUEST", "WEBHOOK_MESSAGE_ID_MISSING");
  const dispatch = (await tx.whatsappDispatch.findFirst({ where: { organizationId, accountId: account.id, providerMessageId: event.providerMessageId }, select: { id: true, status: true, attemptCount: true } })) as { id: string; status: string; attemptCount: number } | null;
  if (!dispatch) throw new EvolutionWebhookError("BAD_REQUEST", "WEBHOOK_MESSAGE_UNKNOWN");
  const failed = isFailedSend(event);
  const status = failed ? "FAILED" : "ACCEPTED";
  const now = new Date();
  const updated = await tx.whatsappDispatch.updateMany({
    where: { id: dispatch.id, organizationId, accountId: account.id, providerMessageId: event.providerMessageId, status: { in: ["IN_FLIGHT", "UNKNOWN", "ACCEPTED"] } },
    data: { status, ...(failed ? { lastErrorCode: "PROVIDER_FAILED" } : { acceptedAt: now }), completedAt: now },
  });
  if (updated.count !== 1) return;
  await tx.auditEvent.create({ data: { organizationId, action: "whatsapp.provider.event", entityType: "WhatsAppDispatch", entityId: dispatch.id, metadata: { eventType: event.eventType, status, attemptCount: dispatch.attemptCount, providerMessageId: event.providerMessageId } } });
}

/** Resolve the opaque instance through tenant-scoped account reads only. */
export async function applyEvolutionWebhookEvent(event: EvolutionWebhookEvent): Promise<void> {
  const organizations = (await getPrismaClient().brokerOrganization.findMany({ select: { id: true }, orderBy: { id: "asc" }, take: 1000 })) as Array<{ id?: string }>;
  for (const organization of organizations) {
    if (!organization.id) continue;
    let matched = false;
    await withTenantPrisma(getPrismaClient() as unknown as PrismaTenantClient, organization.id, async (tx) => {
      const db = tx as WebhookClient;
      const account = (await db.whatsappAccount.findUnique({ where: { instanceName: event.instanceName }, select: { id: true, organizationId: true } })) as { id: string; organizationId?: string | null } | null;
      if (!account) return;
      matched = true;
      if (event.externalId) {
        try {
          await db.interopInboundEvent.create({ data: { provider: "evolution", externalId: event.externalId, organizationId: organization.id, eventType: event.eventType } });
        } catch (error) {
          if (isUniqueViolation(error)) return;
          throw error;
        }
      }
      await applyInTenant(db, organization.id!, account, event);
    });
    if (matched) return;
  }
  throw new EvolutionWebhookError("BAD_REQUEST", "WEBHOOK_INSTANCE_UNKNOWN");
}
