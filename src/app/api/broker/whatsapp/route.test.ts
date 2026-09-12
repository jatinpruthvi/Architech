import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import type { AuthSession } from "@/lib/auth/roles";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  authorize: vi.fn(),
  settings: vi.fn(),
  connect: vi.fn(),
  qr: vi.fn(),
  status: vi.fn(),
  saveTemplate: vi.fn(),
}));

vi.mock("@/lib/auth/guards", () => ({
  authorizeRequest: mocks.authorize,
  isAuthorized: (access: unknown) => Boolean(access && typeof access === "object" && "session" in access),
}));
vi.mock("@/lib/whatsapp/store", () => ({
  readWhatsAppSettings: mocks.settings,
  connectWhatsAppAccount: mocks.connect,
  readWhatsAppQr: mocks.qr,
  refreshWhatsAppConnectionState: mocks.status,
  readWhatsAppTemplate: vi.fn(),
  saveWhatsAppTemplate: mocks.saveTemplate,
}));

import { GET as settingsGET } from "./route";
import { POST as connectPOST } from "./connect/route";
import { GET as qrGET } from "./qr/route";
import { GET as statusGET } from "./status/route";
import { GET as templateGET, PUT as templatePUT } from "./template/route";

const admin: AuthSession = { user: { id: "user_b", name: "Admin", email: "admin@example.com", role: "BROKER_ADMIN" }, organization: { id: "org_b", slug: "org-b", name: "Broker B", verificationStatus: "VERIFIED_PARTNER" }, permissions: ["broker.whatsapp.read", "broker.whatsapp.manage"], source: "better-auth-live" };
const member: AuthSession = { ...admin, user: { ...admin.user, role: "BROKER_MEMBER" }, permissions: ["broker.whatsapp.read"] };

function allow(session: AuthSession = admin) {
  mocks.authorize.mockImplementation(async (_request: Request, options: { permission: string }) => {
    if (session.user.role === "BROKER_MEMBER" && options.permission === "broker.whatsapp.manage") {
      return { response: NextResponse.json({ ok: false }, { status: 403 }) };
    }
    return { session };
  });
}

afterEach(() => vi.clearAllMocks());
beforeEach(() => {
  allow();
  mocks.settings.mockResolvedValue({ enabled: true, plan: { status: "ACTIVE", eligible: true }, account: null, template: null, placeholders: [], delivery: { pending: 0, inFlight: 0, accepted: 0, failed: 0, unknown: 0, skipped: 0, latest: null } });
  mocks.connect.mockResolvedValue({ ok: true, account: { status: "PROVISIONING" }, seededTemplate: true });
  mocks.qr.mockResolvedValue({ state: "QR_READY", qrDataUrl: "data:image/png;base64:short" });
  mocks.status.mockResolvedValue({ status: "CONNECTED", phoneLast4: "3210", lastObservedAt: "2026-09-12T00:00:00.000Z" });
  mocks.saveTemplate.mockResolvedValue({ ok: true, template: { id: "template_1", version: 1, body: "Hi" } });
});

describe("broker WhatsApp routes", () => {
  it("returns the guard response for an unauthenticated request", async () => {
    mocks.authorize.mockResolvedValue({ response: NextResponse.json({ ok: false }, { status: 401 }) });
    const response = await settingsGET(new Request("https://architech.test/api/broker/whatsapp"));
    expect(response.status).toBe(401);
    expect(mocks.settings).not.toHaveBeenCalled();
  });

  it("allows member reads but denies member management", async () => {
    allow(member);
    const read = await settingsGET(new Request("https://architech.test/api/broker/whatsapp"));
    expect(read.status).toBe(200);
    const connect = await connectPOST(new Request("https://architech.test/api/broker/whatsapp/connect", { method: "POST", body: JSON.stringify({ companyOwnedAcknowledged: true }) }));
    expect(connect.status).toBe(403);
    const template = await templatePUT(new Request("https://architech.test/api/broker/whatsapp/template", { method: "PUT", body: JSON.stringify({ body: "Hi" }) }));
    expect(template.status).toBe(403);
  });

  it("uses the session organization and never a body/query tenant id", async () => {
    await connectPOST(new Request("https://architech.test/api/broker/whatsapp/connect?organizationId=org_a", { method: "POST", body: JSON.stringify({ organizationId: "org_a", companyOwnedAcknowledged: true }) }));
    expect(mocks.connect).toHaveBeenCalledWith({ organizationId: "org_b", actorUserId: "user_b", companyOwnedAcknowledged: true });
    await templatePUT(new Request("https://architech.test/api/broker/whatsapp/template", { method: "PUT", body: JSON.stringify({ organizationId: "org_a", body: "Hi {{firstName}}" }) }));
    expect(mocks.saveTemplate).toHaveBeenCalledWith(expect.objectContaining({ organizationId: "org_b", actorUserId: "user_b", body: "Hi {{firstName}}" }));
  });

  it("preserves inactive-plan responses and no-store headers", async () => {
    mocks.connect.mockResolvedValue({ ok: false, status: 402, reason: "NO_ACTIVE_PLAN" });
    const response = await connectPOST(new Request("https://architech.test/api/broker/whatsapp/connect", { method: "POST", body: JSON.stringify({ companyOwnedAcknowledged: true }) }));
    expect(response.status).toBe(402);
    expect(response.headers.get("cache-control")).toBe("no-store");

    const qr = await qrGET(new Request("https://architech.test/api/broker/whatsapp/qr"));
    expect(qr.headers.get("cache-control")).toBe("no-store");
    const qrBody = await qr.json();
    expect(qrBody.qrDataUrl).toContain("data:image");
    expect(JSON.stringify(qrBody)).not.toContain("apikey");
    expect(JSON.stringify(qrBody)).not.toContain("hash");
  });

  it("keeps status and template reads server-only and uncached", async () => {
    const status = await statusGET(new Request("https://architech.test/api/broker/whatsapp/status"));
    expect(status.status).toBe(200);
    expect(status.headers.get("cache-control")).toBe("no-store");
    const template = await templateGET(new Request("https://architech.test/api/broker/whatsapp/template"));
    expect(template.status).toBe(200);
    expect(template.headers.get("cache-control")).toBe("no-store");
  });
});
