import "server-only";

import { WHATSAPP_PROVIDER_TIMEOUT_MS } from "./contracts";
import { WhatsAppProviderError, type WhatsAppProvider } from "./provider";

const EVOLUTION_EVENTS = ["QRCODE_UPDATED", "CONNECTION_UPDATE", "SEND_MESSAGE", "SEND_MESSAGE_UPDATE"] as const;
const QR_DATA_URL_MAX = 100_000;
const OPAQUE_ID_PATTERN = /^[A-Za-z0-9._:-]{1,140}$/;
const STATE_PATTERN = /^[A-Za-z0-9._:-]{1,64}$/;

type JsonRecord = Record<string, unknown>;

type EvolutionConfig = {
  baseUrl: string;
  apiKey: string;
  enabled: boolean;
};

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function safeState(value: unknown): string {
  if (typeof value !== "string") return "UNKNOWN";
  return STATE_PATTERN.test(value) ? value : "UNKNOWN";
}

function safeOpaqueId(value: unknown): string | null {
  if (typeof value !== "string" || !OPAQUE_ID_PATTERN.test(value)) return null;
  return value;
}

function configFromEnv(): EvolutionConfig {
  const baseUrl = process.env.ARCHITECH_EVOLUTION_API_URL?.trim() ?? "";
  const apiKey = process.env.ARCHITECH_EVOLUTION_API_KEY?.trim() ?? "";
  const enabled = process.env.ARCHITECH_WHATSAPP_ENABLED === "true";
  if (!enabled || !baseUrl || !apiKey) {
    throw new WhatsAppProviderError("DISABLED", "PROVIDER_DISABLED");
  }
  return { baseUrl: baseUrl.replace(/\/+$/, ""), apiKey, enabled };
}

function endpoint(baseUrl: string, path: string): string {
  return `${baseUrl}/${path.replace(/^\/+/, "")}`;
}

function providerErrorForResponse(status: number, operation: "create" | "qr" | "state" | "send"): WhatsAppProviderError {
  if (status === 401 || status === 403) return new WhatsAppProviderError("DEFINITIVE", "PROVIDER_AUTH");
  if (status === 404) return new WhatsAppProviderError("DEFINITIVE", operation === "create" ? "PROVIDER_REJECTED" : "INSTANCE_NOT_FOUND");
  if (status >= 500) return new WhatsAppProviderError("AMBIGUOUS", "PROVIDER_UNAVAILABLE");
  return new WhatsAppProviderError("DEFINITIVE", "PROVIDER_REJECTED");
}

async function readJson(response: Response, operation: "create" | "qr" | "state" | "send"): Promise<JsonRecord> {
  if (!response.ok) throw providerErrorForResponse(response.status, operation);
  let value: unknown;
  try {
    value = await response.json();
  } catch {
    throw new WhatsAppProviderError(operation === "send" ? "AMBIGUOUS" : "DEFINITIVE", "PROVIDER_INVALID_RESPONSE");
  }
  if (!isRecord(value)) throw new WhatsAppProviderError(operation === "send" ? "AMBIGUOUS" : "DEFINITIVE", "PROVIDER_INVALID_RESPONSE");
  return value;
}

async function callEvolution(
  config: EvolutionConfig,
  operation: "create" | "qr" | "state" | "send",
  path: string,
  init: RequestInit,
): Promise<JsonRecord> {
  try {
    const response = await fetch(endpoint(config.baseUrl, path), {
      ...init,
      headers: {
        apikey: config.apiKey,
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
      signal: AbortSignal.timeout(WHATSAPP_PROVIDER_TIMEOUT_MS),
    });
    return await readJson(response, operation);
  } catch (error) {
    if (error instanceof WhatsAppProviderError) throw error;
    /* A request may have reached Evolution before the connection failed. The
       worker must therefore never blindly retry this result. */
    throw new WhatsAppProviderError("AMBIGUOUS", error instanceof Error && error.name === "AbortError" ? "PROVIDER_TIMEOUT" : "PROVIDER_NETWORK");
  }
}

function stateFrom(body: JsonRecord, fallback = "UNKNOWN"): string {
  const instance = isRecord(body.instance) ? body.instance : undefined;
  return safeState(body.state ?? body.status ?? body.connectionStatus ?? instance?.state ?? instance?.status ?? instance?.connectionStatus ?? fallback);
}

class EvolutionWhatsAppProvider implements WhatsAppProvider {
  async createInstance(input: Parameters<WhatsAppProvider["createInstance"]>[0]) {
    const config = configFromEnv();
    const body = await callEvolution(config, "create", "instance/create", {
      method: "POST",
      body: JSON.stringify({
        instanceName: input.instanceName,
        integration: "WHATSAPP-BAILEYS",
        qrcode: true,
        webhook: {
          enabled: true,
          url: input.webhookUrl,
          byEvents: true,
          base64: false,
          headers: { jwt_key: input.webhookJwtKey },
          events: [...input.events],
        },
      }),
    });
    const instance = isRecord(body.instance) ? body.instance : {};
    return {
      providerInstanceId: safeOpaqueId(instance.instanceId ?? body.instanceId ?? body.id),
      state: stateFrom(body, "PROVISIONING"),
    };
  }

  async getQr(input: Parameters<WhatsAppProvider["getQr"]>[0]) {
    const config = configFromEnv();
    const body = await callEvolution(config, "qr", `instance/connect/${encodeURIComponent(input.instanceName)}`, { method: "GET" });
    const candidate = body.base64 ?? body.qrcode ?? body.qrDataUrl;
    const qrDataUrl = typeof candidate === "string" && candidate.startsWith("data:image/") && candidate.length <= QR_DATA_URL_MAX ? candidate : undefined;
    return { state: stateFrom(body, qrDataUrl ? "QR_READY" : "UNKNOWN"), ...(qrDataUrl ? { qrDataUrl } : {}) };
  }

  async getConnectionState(input: Parameters<WhatsAppProvider["getConnectionState"]>[0]) {
    const config = configFromEnv();
    const body = await callEvolution(config, "state", `instance/connectionState/${encodeURIComponent(input.instanceName)}`, { method: "GET" });
    return { state: stateFrom(body) };
  }

  async sendText(input: Parameters<WhatsAppProvider["sendText"]>[0]) {
    const config = configFromEnv();
    const body = await callEvolution(config, "send", `message/sendText/${encodeURIComponent(input.instanceName)}`, {
      method: "POST",
      body: JSON.stringify({ number: input.number, text: input.text }),
    });
    const message = isRecord(body.message) ? body.message : {};
    const key = isRecord(body.key) ? body.key : {};
    const messageKey = isRecord(message.key) ? message.key : {};
    const providerMessageId = safeOpaqueId(body.messageId ?? body.id ?? key.id ?? messageKey.id);
    if (!providerMessageId) throw new WhatsAppProviderError("AMBIGUOUS", "PROVIDER_NO_MESSAGE_ID");
    return { providerMessageId };
  }
}

let provider: WhatsAppProvider | undefined;

/** Concrete provider access is server-only and created lazily from env. */
export function getEvolutionProvider(): WhatsAppProvider {
  configFromEnv();
  provider ??= new EvolutionWhatsAppProvider();
  return provider;
}

export { EVOLUTION_EVENTS };
