import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ process: vi.fn() }));
vi.mock("@/lib/whatsapp/worker", () => ({ processWhatsAppOutbox: mocks.process }));

import { POST } from "./route";

beforeEach(() => {
  vi.stubEnv("ARCHITECH_WHATSAPP_WORKER_SECRET", "worker-secret");
  vi.clearAllMocks();
  mocks.process.mockResolvedValue({ scanned: 2, claimed: 2, accepted: 1, failed: 0, unknown: 0, skipped: 1 });
});

describe("scheduled WhatsApp worker route", () => {
  it("requires the server-side secret and does not accept caller tenant input", async () => {
    const unauthorized = await POST(new Request("https://architech.test", { method: "POST", headers: { "x-architech-worker-secret": "wrong" }, body: JSON.stringify({ organizationId: "attacker" }) }));
    expect(unauthorized.status).toBe(401);
    expect(mocks.process).not.toHaveBeenCalled();

    const response = await POST(new Request("https://architech.test", { method: "POST", headers: { "x-architech-worker-secret": "worker-secret" }, body: JSON.stringify({ organizationId: "attacker" }) }));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ ok: true, scanned: 2, claimed: 2, accepted: 1, failed: 0, unknown: 0, skipped: 1 });
    expect(mocks.process).toHaveBeenCalledWith({ limit: 25 });
  });
});
