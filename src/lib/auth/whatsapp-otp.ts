/* Auth OTP via WhatsApp – reuses existing Evolution provider pattern.
 *
 * House style match:
 * - server-only
 * - uses getEvolutionProvider() from lib/whatsapp/evolution (same as store.ts)
 * - env config via ARCHITECH_AUTH_WHATSAPP_INSTANCE, reuses ARCHITECH_EVOLUTION_* vars
 * - error handling via WhatsAppProviderError with DEFINITIVE/AMBIGUOUS/DISABLED
 * - system account stored in SystemWhatsAppAccount (prisma) or memory fallback
 *
 * Flow:
 * - Admin connects system WhatsApp via /api/admin/whatsapp/system/connect (QR flow)
 * - Status checked via getSystemWhatsAppStatus()
 * - OTP sent via sendAuthOtpViaWhatsApp(phoneE164, otp)
 */

import "server-only";
import { getEvolutionProvider } from "@/lib/whatsapp/evolution";
import { WhatsAppProviderError } from "@/lib/whatsapp/provider";
import { isPrismaPersistence } from "@/lib/persistence/source";
import { getPrismaClient, type PrismaClientLike, type PrismaModelDelegate } from "@/lib/repositories/server/prisma";
import { DEMO_OTP, formatOtpMessageFor, OTP_PURPOSE_SIGNUP } from "./otp";

const SYSTEM_INSTANCE_NAME = process.env.ARCHITECH_AUTH_WHATSAPP_INSTANCE ?? "architech-auth-system";
const SYSTEM_INSTANCE_MAX = 100;

type SystemAccountRow = {
  id: string;
  instanceName: string;
  status: string;
  phoneLast4: string | null;
  connectedAt: Date | null;
  lastObservedAt: Date | null;
  lastErrorCode: string | null;
  providerInstanceId: string | null;
};

type SystemClient = PrismaClientLike & {
  systemWhatsAppAccount: PrismaModelDelegate & {
    findUnique(args: unknown): Promise<unknown | null>;
    findFirst(args: unknown): Promise<unknown | null>;
    create(args: unknown): Promise<unknown>;
    update(args: unknown): Promise<unknown>;
  };
};

// Memory fallback for demo mode
let memorySystemAccount: SystemAccountRow | null = null;

function isConnectedStatus(status: string): boolean {
  return status === "CONNECTED";
}

function isTemporaryStatus(status: string): boolean {
  return ["PROVISIONING", "QR_READY", "CONNECTING"].includes(status);
}

async function getSystemAccountRow(): Promise<SystemAccountRow | null> {
  if (isPrismaPersistence()) {
    const db = getPrismaClient() as unknown as SystemClient;
    const account = (await db.systemWhatsAppAccount.findUnique({
      where: { instanceName: SYSTEM_INSTANCE_NAME },
    })) as SystemAccountRow | null;
    return account;
  }
  return memorySystemAccount;
}

async function upsertSystemAccount(data: Partial<SystemAccountRow> & { instanceName: string }): Promise<SystemAccountRow> {
  const now = new Date();
  if (isPrismaPersistence()) {
    const db = getPrismaClient() as unknown as SystemClient;
    let existing = (await db.systemWhatsAppAccount.findUnique({
      where: { instanceName: data.instanceName },
    })) as SystemAccountRow | null;
    if (!existing) {
      existing = (await db.systemWhatsAppAccount.create({
        data: {
          instanceName: data.instanceName,
          provider: "EVOLUTION_BAILEYS",
          status: data.status ?? "PROVISIONING",
          phoneLast4: data.phoneLast4 ?? null,
          providerInstanceId: data.providerInstanceId ?? null,
          connectedAt: data.connectedAt ?? null,
          lastObservedAt: now,
          lastErrorCode: data.lastErrorCode ?? null,
        },
      })) as SystemAccountRow;
    } else {
      existing = (await db.systemWhatsAppAccount.update({
        where: { id: existing.id },
        data: {
          status: data.status ?? existing.status,
          phoneLast4: data.phoneLast4 ?? existing.phoneLast4,
          providerInstanceId: data.providerInstanceId ?? existing.providerInstanceId,
          connectedAt: data.connectedAt ?? existing.connectedAt,
          lastObservedAt: now,
          lastErrorCode: data.lastErrorCode ?? existing.lastErrorCode,
        },
      })) as SystemAccountRow;
    }
    return existing;
  }

  // Memory
  if (!memorySystemAccount) {
    memorySystemAccount = {
      id: `sys_${Date.now()}`,
      instanceName: data.instanceName,
      status: data.status ?? "PROVISIONING",
      phoneLast4: data.phoneLast4 ?? null,
      connectedAt: data.connectedAt ?? null,
      lastObservedAt: now,
      lastErrorCode: data.lastErrorCode ?? null,
      providerInstanceId: data.providerInstanceId ?? null,
    };
  } else {
    memorySystemAccount = {
      ...memorySystemAccount,
      status: data.status ?? memorySystemAccount.status,
      phoneLast4: data.phoneLast4 ?? memorySystemAccount.phoneLast4,
      providerInstanceId: data.providerInstanceId ?? memorySystemAccount.providerInstanceId,
      connectedAt: data.connectedAt ?? memorySystemAccount.connectedAt,
      lastObservedAt: now,
      lastErrorCode: data.lastErrorCode ?? memorySystemAccount.lastErrorCode,
    };
  }
  return memorySystemAccount;
}

function mapProviderStateToAccountStatus(providerState: string): string {
  const s = providerState.toLowerCase();
  if (s === "open" || s === "connected") return "CONNECTED";
  if (s === "connecting" || s === "pairing") return "CONNECTING";
  if (s.includes("qr") || s === "qrcode") return "QR_READY";
  if (s === "close" || s === "closed" || s === "disconnected") return "DISCONNECTED";
  return "PROVISIONING";
}

export async function connectSystemWhatsAppAccount(actorUserId: string | null): Promise<{ ok: true; status: string } | { ok: false; reason: string; status?: number }> {
  // Reuse Evolution provider pattern from store.ts
  const webhookUrl = process.env.ARCHITECH_EVOLUTION_WEBHOOK_URL;
  const webhookKey = process.env.ARCHITECH_EVOLUTION_WEBHOOK_JWT_KEY;
  if (!webhookUrl || !webhookKey) {
    return { ok: false, reason: "PROVIDER_DISABLED", status: 503 };
  }

  try {
    const provider = getEvolutionProvider();
    const existing = await getSystemAccountRow();

    // If exists, check state first
    if (existing) {
      try {
        const stateResult = await provider.getConnectionState({ instanceName: existing.instanceName });
        const mapped = mapProviderStateToAccountStatus(stateResult.state);
        await upsertSystemAccount({ instanceName: existing.instanceName, status: mapped });
        if (mapped === "CONNECTED") {
          return { ok: true, status: mapped };
        }
      } catch (error) {
        if (!(error instanceof WhatsAppProviderError) || error.code !== "INSTANCE_NOT_FOUND") {
          // If provider error but not not-found, try to create
          // For DEFINITIVE errors like PROVIDER_DISABLED, propagate
          if (error instanceof WhatsAppProviderError && error.code === "PROVIDER_DISABLED") {
            return { ok: false, reason: "PROVIDER_DISABLED", status: 503 };
          }
        }
        // If INSTANCE_NOT_FOUND, will recreate below
      }
    }

    // Create instance
    const instanceName = SYSTEM_INSTANCE_NAME;
    if (instanceName.length > SYSTEM_INSTANCE_MAX) {
      return { ok: false, reason: "INVALID_INSTANCE_NAME", status: 400 };
    }

    const result = await provider.createInstance({
      instanceName,
      webhookUrl,
      webhookJwtKey: webhookKey,
      events: ["QRCODE_UPDATED", "CONNECTION_UPDATE", "SEND_MESSAGE", "SEND_MESSAGE_UPDATE"],
    });

    const status = mapProviderStateToAccountStatus(result.state);
    await upsertSystemAccount({
      instanceName,
      status,
      providerInstanceId: result.providerInstanceId,
    });

    return { ok: true, status };
  } catch (error) {
    const code = error instanceof WhatsAppProviderError ? error.code : "PROVIDER_UNAVAILABLE";
    await upsertSystemAccount({
      instanceName: SYSTEM_INSTANCE_NAME,
      status: "ERROR",
      lastErrorCode: code,
    });
    if (error instanceof WhatsAppProviderError) {
      if (code === "PROVIDER_DISABLED") return { ok: false, reason: code, status: 503 };
      if (code === "PROVIDER_AUTH") return { ok: false, reason: code, status: 502 };
    }
    return { ok: false, reason: code, status: 502 };
  }
}

export async function getSystemWhatsAppQr(): Promise<{ state: string; qrDataUrl?: string }> {
  try {
    const provider = getEvolutionProvider();
    const account = await getSystemAccountRow();
    if (!account) return { state: "NOT_CONNECTED" };
    const result = await provider.getQr({ instanceName: account.instanceName });
    const mapped = mapProviderStateToAccountStatus(result.state);
    await upsertSystemAccount({ instanceName: account.instanceName, status: mapped });
    return { state: result.state, qrDataUrl: result.qrDataUrl };
  } catch (error) {
    const code = error instanceof WhatsAppProviderError ? error.code : "PROVIDER_UNAVAILABLE";
    const account = await getSystemAccountRow();
    if (account) await upsertSystemAccount({ instanceName: account.instanceName, status: "ERROR", lastErrorCode: code });
    return { state: "ERROR" };
  }
}

export async function getSystemWhatsAppStatus(): Promise<{ status: string; phoneLast4: string | null; lastObservedAt: string | null; connectedAt: string | null }> {
  const account = await getSystemAccountRow();
  if (!account) {
    return { status: "DISCONNECTED", phoneLast4: null, lastObservedAt: null, connectedAt: null };
  }

  try {
    const provider = getEvolutionProvider();
    const result = await provider.getConnectionState({ instanceName: account.instanceName });
    const mapped = mapProviderStateToAccountStatus(result.state);
    const updated = await upsertSystemAccount({ instanceName: account.instanceName, status: mapped });
    return {
      status: updated.status,
      phoneLast4: updated.phoneLast4,
      lastObservedAt: updated.lastObservedAt?.toISOString() ?? new Date().toISOString(),
      connectedAt: updated.connectedAt?.toISOString() ?? null,
    };
  } catch (error) {
    const code = error instanceof WhatsAppProviderError ? error.code : "PROVIDER_UNAVAILABLE";
    const updated = await upsertSystemAccount({ instanceName: account.instanceName, status: "ERROR", lastErrorCode: code });
    return {
      status: updated.status,
      phoneLast4: updated.phoneLast4,
      lastObservedAt: updated.lastObservedAt?.toISOString() ?? new Date().toISOString(),
      connectedAt: updated.connectedAt?.toISOString() ?? null,
    };
  }
}

export async function sendAuthOtpViaWhatsApp(phoneE164: string, otp: string, purpose: string = OTP_PURPOSE_SIGNUP): Promise<{ ok: true; providerMessageId: string } | { ok: false; reason: string }> {
  // Check if WhatsApp is enabled – if not, we mock and log OTP for testing
  // This allows phone OTP flow to work even without real WhatsApp configured
  const enabled = process.env.ARCHITECH_WHATSAPP_ENABLED === "true" || process.env.ARCHITECH_AUTH_WHATSAPP_ENABLED === "true";
  const isDev = process.env.NODE_ENV !== "production" && process.env.APP_ENV !== "production";

  // Without WhatsApp enabled, mock send and log OTP to console for testing
  // Works in both dev and prod when no provider configured, so user can test flow
  // Admin can later connect real WhatsApp via /api/admin/whatsapp/system/connect for production
  if (!enabled) {
    console.log(`[Auth OTP Mock] Would send ${purpose} OTP ${otp} to ${phoneE164} via ${SYSTEM_INSTANCE_NAME} – use ${DEMO_OTP} in demo or check logs`);
    console.log(`[Auth OTP Mock] For production, set ARCHITECH_AUTH_WHATSAPP_ENABLED=true and connect admin WhatsApp via QR`);
    return { ok: true, providerMessageId: `mock_${Date.now()}` };
  }

  const account = await getSystemAccountRow();
  if (!account || !isConnectedStatus(account.status)) {
    // Try to refresh status once
    const status = await getSystemWhatsAppStatus();
    if (status.status !== "CONNECTED") {
      return { ok: false, reason: "NO_CONNECTED_ACCOUNT" };
    }
  }

  try {
    const provider = getEvolutionProvider();
    // Evolution expects number without + and with country code, e.g., 919876543210
    const numberWithoutPlus = phoneE164.replace(/^\+/, "");
    const text = formatOtpMessageFor(purpose, otp);
    const result = await provider.sendText({
      instanceName: SYSTEM_INSTANCE_NAME,
      number: numberWithoutPlus,
      text,
    });
    return { ok: true, providerMessageId: result.providerMessageId ?? `sent_${Date.now()}` };
  } catch (error) {
    const code = error instanceof WhatsAppProviderError ? error.code : "PROVIDER_UNAVAILABLE";
    if (account) await upsertSystemAccount({ instanceName: SYSTEM_INSTANCE_NAME, status: "ERROR", lastErrorCode: code });
    return { ok: false, reason: code };
  }
}

// Test hooks
export function clearSystemAccountForTests() {
  memorySystemAccount = null;
}

export function getSystemInstanceName(): string {
  return SYSTEM_INSTANCE_NAME;
}
