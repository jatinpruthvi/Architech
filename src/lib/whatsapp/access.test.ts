import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const plan = vi.hoisted(() => ({ resolve: vi.fn() }));
vi.mock("@/lib/plans/plan-status", () => ({ resolvePlanStatusForOrg: plan.resolve }));

import { resolveWhatsAppPlanGate } from "./access";

afterEach(() => {
  vi.unstubAllEnvs();
  plan.resolve.mockReset();
});

function providerEnv() {
  vi.stubEnv("ARCHITECH_WHATSAPP_ENABLED", "true");
  vi.stubEnv("ARCHITECH_WHATSAPP_REAL_NUMBERS_ENABLED", "true");
  vi.stubEnv("ARCHITECH_EVOLUTION_API_URL", "http://evolution.internal:8080");
  vi.stubEnv("ARCHITECH_EVOLUTION_API_KEY", "provider-key");
  vi.stubEnv("ARCHITECH_EVOLUTION_WEBHOOK_JWT_KEY", "webhook-secret");
  vi.stubEnv("ARCHITECH_EVOLUTION_WEBHOOK_URL", "https://architech.example/api/internal/providers/evolution/webhook");
}

describe("WhatsApp plan/provider gate", () => {
  it("passes only an exact ACTIVE subscription with complete enabled configuration", async () => {
    providerEnv();
    plan.resolve.mockResolvedValue("ACTIVE");
    await expect(resolveWhatsAppPlanGate("org_1")).resolves.toEqual({ ok: true, status: "ACTIVE" });
    expect(plan.resolve).toHaveBeenCalledWith("org_1");
  });

  it("rejects every non-ACTIVE status without entitlement inference", async () => {
    providerEnv();
    for (const status of ["TRIAL", "EXPIRED", "NONE"] as const) {
      plan.resolve.mockResolvedValue(status);
      await expect(resolveWhatsAppPlanGate("org_1")).resolves.toEqual({ ok: false, status: 402, reason: "NO_ACTIVE_PLAN" });
    }
  });

  it("fails closed for disabled feature, real-number, and provider configuration gates", async () => {
    plan.resolve.mockResolvedValue("ACTIVE");
    vi.stubEnv("ARCHITECH_WHATSAPP_ENABLED", "false");
    await expect(resolveWhatsAppPlanGate("org_1")).resolves.toEqual({ ok: false, status: 503, reason: "PROVIDER_DISABLED" });

    providerEnv();
    vi.stubEnv("ARCHITECH_WHATSAPP_REAL_NUMBERS_ENABLED", "false");
    await expect(resolveWhatsAppPlanGate("org_1")).resolves.toEqual({ ok: false, status: 503, reason: "REAL_NUMBERS_DISABLED" });

    providerEnv();
    vi.stubEnv("ARCHITECH_EVOLUTION_API_KEY", "");
    await expect(resolveWhatsAppPlanGate("org_1")).resolves.toEqual({ ok: false, status: 503, reason: "PROVIDER_DISABLED" });
  });
});
