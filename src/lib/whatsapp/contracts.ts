export const WHATSAPP_DISPATCH_PURPOSE = "lead-ack" as const;
export const WHATSAPP_PROVIDER = "EVOLUTION_BAILEYS" as const;
export const ALLOWED_ACKNOWLEDGEMENT_PLACEHOLDERS = ["firstName", "brokerName", "listingTitle", "city"] as const;
export const ACKNOWLEDGEMENT_BODY_MAX = 1200;
export const ACKNOWLEDGEMENT_RENDERED_MAX = 1500;
export const WHATSAPP_DISPATCH_TTL_MS = 15 * 60 * 1000;
export const WHATSAPP_PROVIDER_TIMEOUT_MS = 12_000;
export const WHATSAPP_IN_FLIGHT_STALE_MS = 20_000;

export type WhatsAppAccountStatus = "PROVISIONING" | "QR_READY" | "CONNECTING" | "CONNECTED" | "DISCONNECTED" | "ERROR";
export type WhatsAppDispatchStatus = "PENDING" | "IN_FLIGHT" | "ACCEPTED" | "FAILED" | "UNKNOWN" | "SKIPPED";
export type WhatsAppTemplatePlaceholder = (typeof ALLOWED_ACKNOWLEDGEMENT_PLACEHOLDERS)[number];

export type AcknowledgementValues = Record<WhatsAppTemplatePlaceholder, string>;

export type WhatsAppSkipReason =
  | "NO_ACTIVE_PLAN"
  | "NO_WHATSAPP_OPT_IN"
  | "CONSENT_CLASS_BLOCKED"
  | "NO_ACTIVE_TEMPLATE"
  | "NO_CONNECTED_ACCOUNT"
  | "LEAD_DELETED"
  | "LEAD_EXPIRED"
  | "TEMPLATE_VERSION_MISSING"
  | "INVALID_PHONE"
  | "PROVIDER_DISABLED";

export type WhatsAppPlanStatus = "TRIAL" | "ACTIVE" | "EXPIRED" | "NONE";

export type WhatsAppPlanGate =
  | { ok: true; status: "ACTIVE" }
  | { ok: false; status: 402 | 503; reason: "NO_ACTIVE_PLAN" | "PROVIDER_DISABLED" | "REAL_NUMBERS_DISABLED" };

export type WhatsAppDeliveryLatest = {
  status: WhatsAppDispatchStatus;
  providerMessageId: string | null;
  acceptedAt: string | null;
  completedAt: string | null;
};

export type WhatsAppDeliverySummary = {
  pending: number;
  inFlight: number;
  accepted: number;
  failed: number;
  unknown: number;
  skipped: number;
  latest: WhatsAppDeliveryLatest | null;
};

export type WhatsAppSettingsResponse = {
  enabled: boolean;
  plan: { status: WhatsAppPlanStatus; eligible: boolean; reason?: string };
  account: {
    status: WhatsAppAccountStatus;
    phoneLast4: string | null;
    connectedAt: string | null;
    lastObservedAt: string | null;
    lastErrorCode: string | null;
  } | null;
  template: { id: string; version: number; body: string; createdAt: string } | null;
  placeholders: readonly string[];
  delivery: WhatsAppDeliverySummary;
};

export type WhatsAppBatchResult = {
  scanned: number;
  claimed: number;
  accepted: number;
  failed: number;
  unknown: number;
  skipped: number;
  pending: number;
};

export function isWhatsAppAccountStatus(value: string): value is WhatsAppAccountStatus {
  return ["PROVISIONING", "QR_READY", "CONNECTING", "CONNECTED", "DISCONNECTED", "ERROR"].includes(value);
}

export function isWhatsAppDispatchStatus(value: string): value is WhatsAppDispatchStatus {
  return ["PENDING", "IN_FLIGHT", "ACCEPTED", "FAILED", "UNKNOWN", "SKIPPED"].includes(value);
}
