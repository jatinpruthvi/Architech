import "server-only";

import { resolvePlanStatusForOrg } from "@/lib/plans/plan-status";
import type { WhatsAppPlanGate } from "./contracts";

const REQUIRED_PROVIDER_VALUES = [
  "ARCHITECH_EVOLUTION_API_URL",
  "ARCHITECH_EVOLUTION_API_KEY",
  "ARCHITECH_EVOLUTION_WEBHOOK_JWT_KEY",
  "ARCHITECH_EVOLUTION_WEBHOOK_URL",
] as const;

function hasProviderConfiguration(): boolean {
  return REQUIRED_PROVIDER_VALUES.every((name) => Boolean(process.env[name]?.trim()));
}

/**
 * Shared server-side send/connect gate.
 *
 * Plan status is deliberately an exact subscription status check. The feature
 * has no plan entitlement lookup and does not infer eligibility from city,
 * organization slug, or any browser-provided value.
 */
export async function resolveWhatsAppPlanGate(organizationId: string): Promise<WhatsAppPlanGate> {
  const planStatus = await resolvePlanStatusForOrg(organizationId);
  if (planStatus !== "ACTIVE") return { ok: false, status: 402, reason: "NO_ACTIVE_PLAN" };
  if (process.env.ARCHITECH_WHATSAPP_ENABLED !== "true" || !hasProviderConfiguration()) {
    return { ok: false, status: 503, reason: "PROVIDER_DISABLED" };
  }
  if (process.env.ARCHITECH_WHATSAPP_REAL_NUMBERS_ENABLED !== "true") {
    return { ok: false, status: 503, reason: "REAL_NUMBERS_DISABLED" };
  }
  return { ok: true, status: "ACTIVE" };
}
