import "server-only";

import { randomBytes } from "node:crypto";
import { isPrismaLeadStorage } from "@/lib/leads/source";
import { resolvePlanStatusForOrg } from "@/lib/plans/plan-status";
import { getPrismaClient, type PrismaClientLike, type PrismaModelDelegate } from "@/lib/repositories/server/prisma";
import { withTenantPrisma, type PrismaTenantClient } from "@/lib/repositories/server/tenant";
import { resolveWhatsAppPlanGate } from "./access";
import {
  ALLOWED_ACKNOWLEDGEMENT_PLACEHOLDERS,
  WHATSAPP_PROVIDER,
  isWhatsAppAccountStatus,
  isWhatsAppDispatchStatus,
  type WhatsAppAccountStatus,
  type WhatsAppDeliverySummary,
  type WhatsAppSettingsResponse,
} from "./contracts";
import { getEvolutionProvider } from "./evolution";
import { DEFAULT_ACKNOWLEDGEMENT_BODY, validateAcknowledgementTemplate } from "./template";
import { WhatsAppProviderError } from "./provider";

const EVOLUTION_EVENTS = ["QRCODE_UPDATED", "CONNECTION_UPDATE", "SEND_MESSAGE", "SEND_MESSAGE_UPDATE"];

type StoreClient = PrismaClientLike & {
  brokerOrganization: PrismaClientLike["brokerOrganization"];
  whatsappAccount: PrismaModelDelegate;
  whatsappTemplate: PrismaModelDelegate;
  whatsappDispatch: PrismaModelDelegate;
  auditEvent: PrismaModelDelegate;
};

type AccountRow = {
  id: string;
  instanceName: string;
  providerInstanceId?: string | null;
  status: string;
  phoneLast4?: string | null;
  connectedAt?: unknown;
  lastObservedAt?: unknown;
  lastErrorCode?: string | null;
};
type TemplateRow = { id: string; version: number; body: string; createdAt: unknown };
type DispatchRow = { status: string; providerMessageId?: string | null; acceptedAt?: unknown; completedAt?: unknown; createdAt?: unknown };

export class WhatsAppStoreError extends Error {
  constructor(readonly status: number, readonly reason: string) {
    super(reason);
    this.name = "WhatsAppStoreError";
  }
}

function asDateString(value: unknown): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function accountStatus(value: unknown): WhatsAppAccountStatus {
  return typeof value === "string" && isWhatsAppAccountStatus(value) ? value : "ERROR";
}

function dispatchStatus(value: unknown) {
  return typeof value === "string" && isWhatsAppDispatchStatus(value) ? value : "UNKNOWN";
}

function mapProviderState(value: string, current: WhatsAppAccountStatus): WhatsAppAccountStatus {
  const state = value.trim().toLowerCase();
  if (["open", "connected", "online"].includes(state)) return "CONNECTED";
  if (["connecting", "opening"].includes(state)) return "CONNECTING";
  if (["qr", "qr_ready", "qrcode", "waiting"].includes(state)) return "QR_READY";
  if (["close", "closed", "disconnected", "logout"].includes(state)) return "DISCONNECTED";
  if (["error", "failed"].includes(state)) return "ERROR";
  return current;
}

function opaqueInstanceName(): string {
  return `wa_${randomBytes(12).toString("base64url")}`;
}

function dbClient(): PrismaTenantClient {
  return getPrismaClient() as unknown as PrismaTenantClient;
}

async function withOrganization<T>(organizationId: string, work: (tx: StoreClient) => Promise<T>): Promise<T> {
  return withTenantPrisma(dbClient(), organizationId, (tx) => work(tx as StoreClient));
}

function emptyDelivery(): WhatsAppDeliverySummary {
  return { pending: 0, inFlight: 0, accepted: 0, failed: 0, unknown: 0, skipped: 0, latest: null };
}

function unavailableSettings(reason = "PROVIDER_DISABLED"): WhatsAppSettingsResponse {
  return {
    enabled: false,
    plan: { status: "ACTIVE", eligible: false, reason },
    account: null,
    template: null,
    placeholders: ALLOWED_ACKNOWLEDGEMENT_PLACEHOLDERS,
    delivery: emptyDelivery(),
  };
}

async function planGate(organizationId: string) {
  const [status, gate] = await Promise.all([resolvePlanStatusForOrg(organizationId), resolveWhatsAppPlanGate(organizationId)]);
  return { status, gate };
}

export async function readWhatsAppSettings(organizationId: string): Promise<WhatsAppSettingsResponse> {
  const { status, gate } = await planGate(organizationId);
  if (!isPrismaLeadStorage()) {
    return unavailableSettings(gate.ok ? "PROVIDER_DISABLED" : gate.reason);
  }

  return withOrganization(organizationId, async (tx) => {
    const account = (await tx.whatsappAccount.findUnique({ where: { organizationId } })) as AccountRow | null;
    const template = (await tx.whatsappTemplate.findFirst({
      where: { organizationId, isActive: true },
      orderBy: [{ version: "desc" }, { id: "desc" }],
      select: { id: true, version: true, body: true, createdAt: true },
    })) as TemplateRow | null;
    const rows = (await tx.whatsappDispatch.findMany({
      where: { organizationId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 500,
      select: { status: true, providerMessageId: true, acceptedAt: true, completedAt: true, createdAt: true },
    })) as DispatchRow[];

    const delivery = emptyDelivery();
    for (const row of rows) {
      const current = dispatchStatus(row.status);
      if (current === "PENDING") delivery.pending += 1;
      else if (current === "IN_FLIGHT") delivery.inFlight += 1;
      else if (current === "ACCEPTED") delivery.accepted += 1;
      else if (current === "FAILED") delivery.failed += 1;
      else if (current === "UNKNOWN") delivery.unknown += 1;
      else if (current === "SKIPPED") delivery.skipped += 1;
      if (!delivery.latest) {
        delivery.latest = {
          status: current,
          providerMessageId: typeof row.providerMessageId === "string" ? row.providerMessageId : null,
          acceptedAt: asDateString(row.acceptedAt),
          completedAt: asDateString(row.completedAt),
        };
      }
    }

    const safeTemplate = template && validateAcknowledgementTemplate(template.body).ok
      ? { id: template.id, version: template.version, body: template.body, createdAt: asDateString(template.createdAt) ?? new Date(0).toISOString() }
      : null;
    return {
      enabled: gate.ok,
      plan: { status, eligible: gate.ok, ...(gate.ok ? {} : { reason: gate.reason }) },
      account: account
        ? {
            status: accountStatus(account.status),
            phoneLast4: account.phoneLast4 ?? null,
            connectedAt: asDateString(account.connectedAt),
            lastObservedAt: asDateString(account.lastObservedAt),
            lastErrorCode: account.lastErrorCode ?? null,
          }
        : null,
      template: safeTemplate,
      placeholders: ALLOWED_ACKNOWLEDGEMENT_PLACEHOLDERS,
      delivery,
    };
  });
}

async function accountForOrganization(organizationId: string): Promise<AccountRow | null> {
  return withOrganization(organizationId, async (tx) => {
    return (await tx.whatsappAccount.findUnique({ where: { organizationId } })) as AccountRow | null;
  });
}

async function recordAccountState(
  organizationId: string,
  accountId: string,
  status: WhatsAppAccountStatus,
  actorUserId: string | null,
  extra: { providerInstanceId?: string | null; lastErrorCode?: string | null; action?: string } = {},
): Promise<{ phoneLast4: string | null; lastObservedAt: string }> {
  const observedAt = new Date();
  return withOrganization(organizationId, async (tx) => {
    const updated = (await tx.whatsappAccount.update({
      where: { id: accountId },
      data: {
        status,
        lastObservedAt: observedAt,
        ...(status === "CONNECTED" ? { connectedAt: observedAt } : {}),
        ...(extra.providerInstanceId ? { providerInstanceId: extra.providerInstanceId } : {}),
        ...(extra.lastErrorCode !== undefined ? { lastErrorCode: extra.lastErrorCode } : {}),
      },
    })) as AccountRow;
    await tx.auditEvent.create({
      data: {
        organizationId,
        actorUserId,
        action: extra.action ?? "whatsapp.account.state_observed",
        entityType: "WhatsAppAccount",
        entityId: accountId,
        metadata: { status },
      },
    });
    return { phoneLast4: updated.phoneLast4 ?? null, lastObservedAt: observedAt.toISOString() };
  });
}

export async function connectWhatsAppAccount(input: {
  organizationId: string;
  actorUserId: string;
  companyOwnedAcknowledged: boolean;
}): Promise<{ ok: true; account: { status: WhatsAppAccountStatus }; seededTemplate: boolean } | { ok: false; status: number; reason: string }> {
  const gate = await resolveWhatsAppPlanGate(input.organizationId);
  if (!gate.ok) return gate;
  if (input.companyOwnedAcknowledged !== true) return { ok: false, status: 400, reason: "COMPANY_OWNERSHIP_ACK_REQUIRED" };
  if (!isPrismaLeadStorage()) return { ok: false, status: 503, reason: "PERSISTENCE_DISABLED" };

  const prepared = await withOrganization(input.organizationId, async (tx) => {
    let account = (await tx.whatsappAccount.findUnique({ where: { organizationId: input.organizationId } })) as AccountRow | null;
    const created = !account;
    if (!account) {
      account = (await tx.whatsappAccount.create({
        data: { organizationId: input.organizationId, provider: WHATSAPP_PROVIDER, instanceName: opaqueInstanceName(), status: "PROVISIONING" },
      })) as AccountRow;
    }
    const existingTemplate = await tx.whatsappTemplate.findFirst({ where: { organizationId: input.organizationId, isActive: true }, orderBy: [{ version: "desc" }, { id: "desc" }] });
    let seededTemplate = false;
    if (!existingTemplate) {
      await tx.whatsappTemplate.create({ data: { organizationId: input.organizationId, version: 1, body: DEFAULT_ACKNOWLEDGEMENT_BODY, isActive: true, createdById: input.actorUserId } });
      seededTemplate = true;
    }
    return { account, created, seededTemplate };
  });

  const account = prepared.account;
  try {
    const provider = getEvolutionProvider();
    let state: string;
    let providerInstanceId: string | null = null;
    if (prepared.created) {
      const result = await provider.createInstance({
        instanceName: account.instanceName,
        webhookUrl: process.env.ARCHITECH_EVOLUTION_WEBHOOK_URL!,
        webhookJwtKey: process.env.ARCHITECH_EVOLUTION_WEBHOOK_JWT_KEY!,
        events: EVOLUTION_EVENTS,
      });
      state = result.state;
      providerInstanceId = result.providerInstanceId;
    } else {
      const result = await provider.getConnectionState({ instanceName: account.instanceName });
      state = result.state;
    }
    const status = mapProviderState(state, accountStatus(account.status));
    await recordAccountState(input.organizationId, account.id, status, input.actorUserId, {
      providerInstanceId,
      action: "whatsapp.account.connected",
    });
    return { ok: true, account: { status }, seededTemplate: prepared.seededTemplate };
  } catch (error) {
    const code = error instanceof WhatsAppProviderError ? error.code : "PROVIDER_UNAVAILABLE";
    await recordAccountState(input.organizationId, account.id, "ERROR", input.actorUserId, { lastErrorCode: code, action: "whatsapp.account.connection_failed" });
    return { ok: false, status: 502, reason: code };
  }
}

export async function readWhatsAppQr(organizationId: string): Promise<{ state: string; qrDataUrl?: string }> {
  const gate = await resolveWhatsAppPlanGate(organizationId);
  if (!gate.ok) return { state: gate.reason };
  if (!isPrismaLeadStorage()) return { state: "PROVIDER_DISABLED" };
  const account = await accountForOrganization(organizationId);
  if (!account) return { state: "NOT_CONNECTED" };
  try {
    const result = await getEvolutionProvider().getQr({ instanceName: account.instanceName });
    const status = mapProviderState(result.state, accountStatus(account.status));
    await recordAccountState(organizationId, account.id, status, null, { action: "whatsapp.qr.requested" });
    return { state: result.state, ...(result.qrDataUrl ? { qrDataUrl: result.qrDataUrl } : {}) };
  } catch (error) {
    const code = error instanceof WhatsAppProviderError ? error.code : "PROVIDER_UNAVAILABLE";
    await recordAccountState(organizationId, account.id, "ERROR", null, { lastErrorCode: code, action: "whatsapp.qr.failed" });
    return { state: "ERROR" };
  }
}

export async function refreshWhatsAppConnectionState(organizationId: string): Promise<{ status: WhatsAppAccountStatus; phoneLast4: string | null; lastObservedAt: string }> {
  const gate = await resolveWhatsAppPlanGate(organizationId);
  const account = isPrismaLeadStorage() ? await accountForOrganization(organizationId) : null;
  if (!account) return { status: "DISCONNECTED", phoneLast4: null, lastObservedAt: new Date().toISOString() };
  if (!gate.ok) return { status: accountStatus(account.status), phoneLast4: account.phoneLast4 ?? null, lastObservedAt: asDateString(account.lastObservedAt) ?? new Date().toISOString() };
  try {
    const result = await getEvolutionProvider().getConnectionState({ instanceName: account.instanceName });
    const status = mapProviderState(result.state, accountStatus(account.status));
    const observed = await recordAccountState(organizationId, account.id, status, null);
    return { status, ...observed };
  } catch (error) {
    const code = error instanceof WhatsAppProviderError ? error.code : "PROVIDER_UNAVAILABLE";
    const observed = await recordAccountState(organizationId, account.id, "ERROR", null, { lastErrorCode: code });
    return { status: "ERROR", ...observed };
  }
}

export async function saveWhatsAppTemplate(input: {
  organizationId: string;
  actorUserId: string;
  body: string;
}): Promise<{ ok: true; template: { id: string; version: number; body: string } } | { ok: false; status: number; errors: string[] }> {
  const gate = await resolveWhatsAppPlanGate(input.organizationId);
  if (!gate.ok) return { ok: false, status: gate.status, errors: [gate.reason] };
  const validation = validateAcknowledgementTemplate(input.body);
  if (!validation.ok) return { ok: false, status: 400, errors: validation.errors };
  if (!isPrismaLeadStorage()) return { ok: false, status: 503, errors: ["PERSISTENCE_DISABLED"] };

  try {
    const template = await withOrganization(input.organizationId, async (tx) => {
      /* Updating the organization row serializes version allocation for this
         tenant. Without this lock, two concurrent saves can both observe the
         same latest version and race into the unique index. */
      await tx.brokerOrganization.update({ where: { id: input.organizationId }, data: { updatedAt: new Date() } });
      const latest = (await tx.whatsappTemplate.findFirst({ where: { organizationId: input.organizationId }, orderBy: [{ version: "desc" }, { id: "desc" }], select: { version: true } })) as { version?: number } | null;
      const version = Number(latest?.version ?? 0) + 1;
      await tx.whatsappTemplate.updateMany({ where: { organizationId: input.organizationId, isActive: true }, data: { isActive: false } });
      const created = (await tx.whatsappTemplate.create({ data: { organizationId: input.organizationId, version, body: validation.body, isActive: true, createdById: input.actorUserId } })) as { id: string; version: number; body: string };
      await tx.auditEvent.create({ data: { organizationId: input.organizationId, actorUserId: input.actorUserId, action: "whatsapp.template.updated", entityType: "WhatsAppTemplate", entityId: created.id, metadata: { version } } });
      return created;
    });
    return { ok: true, template: { id: template.id, version: template.version, body: template.body } };
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && (error as { code?: unknown }).code === "P2002") {
      return { ok: false, status: 409, errors: ["Template version changed; please retry."] };
    }
    throw error;
  }
}
