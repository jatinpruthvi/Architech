import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  verify: vi.fn(),
  apply: vi.fn(),
}));

vi.mock("@/lib/whatsapp/webhook", async () => {
  const actual = await vi.importActual<typeof import("@/lib/whatsapp/webhook")>("@/lib/whatsapp/webhook");
  return { ...actual, verifyEvolutionWebhookRequest: mocks.verify, applyEvolutionWebhookEvent: mocks.apply };
});

import { EvolutionWebhookError } from "@/lib/whatsapp/webhook";
import { POST } from "./route";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.verify.mockReturnValue({ eventType: "CONNECTION_UPDATE", instanceName: "wa_a", connectionState: "open" });
  mocks.apply.mockResolvedValue(undefined);
});

describe("Evolution webhook route", () => {
  it("passes the exact body and authorization through and returns a generic success", async () => {
    const request = new Request("https://architech.test/api/internal/providers/evolution/webhook", { method: "POST", headers: { authorization: "Bearer signed" }, body: '{"data":{"state":"open"}}' });
    const response = await POST(request);
    expect(response.status).toBe(204);
    expect(mocks.verify).toHaveBeenCalledWith('{"data":{"state":"open"}}', "Bearer signed");
    expect(mocks.apply).toHaveBeenCalledWith(expect.objectContaining({ instanceName: "wa_a" }));
  });

  it("returns safe auth/input errors and does not log or expose the body", async () => {
    mocks.verify.mockImplementationOnce(() => { throw new EvolutionWebhookError("AUTH", "WEBHOOK_SIGNATURE_INVALID"); });
    const response = await POST(new Request("https://architech.test", { method: "POST", headers: { authorization: "Bearer bad" }, body: "private customer content" }));
    expect(response.status).toBe(401);
    const payload = await response.json();
    expect(payload).toEqual({ ok: false, errors: ["WEBHOOK_SIGNATURE_INVALID"] });
    expect(JSON.stringify(payload)).not.toContain("private");
  });

  it("treats verified unsupported events as a harmless no-op and rejects oversized bodies", async () => {
    mocks.verify.mockImplementationOnce(() => { throw new EvolutionWebhookError("UNSUPPORTED", "WEBHOOK_EVENT_IGNORED"); });
    expect((await POST(new Request("https://architech.test", { method: "POST", body: "{}" }))).status).toBe(204);
    expect(mocks.apply).not.toHaveBeenCalled();

    const oversized = await POST(new Request("https://architech.test", { method: "POST", body: "x".repeat(128 * 1024 + 1) }));
    expect(oversized.status).toBe(413);
    expect(mocks.verify).toHaveBeenCalledTimes(1);
  });
});
