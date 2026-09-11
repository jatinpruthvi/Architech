import { randomBytes, scryptSync } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const database = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  marketplacePlan: { findUnique: vi.fn(), findMany: vi.fn(), count: vi.fn(), create: vi.fn() },
  marketplaceSubscription: { findFirst: vi.fn(), findMany: vi.fn(), update: vi.fn(), create: vi.fn() },
  auditEvent: { create: vi.fn() },
  $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(database)),
}));

vi.mock("@/lib/repositories/server/prisma", () => ({ getPrismaClient: () => database }));
import { POST as signInPost } from "../../../app/api/auth/super/sign-in/route";
import { POST as signOutPost } from "../../../app/api/auth/super/sign-out/route";
import { GET as plansGet, POST as plansPost } from "../../../app/api/admin/plans/route";
import { POST as definitionsPost } from "../../../app/api/admin/plans/definitions/route";
import { SUPER_ADMIN_COOKIE } from "./auth/super-admin";

const SECRET = "contract-test-better-auth-secret";
const PASSWORD = "contract-test-owner-password";

function storedHash(): string {
  const salt = randomBytes(16);
  const hash = scryptSync(PASSWORD, salt, 32, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

async function json(response: Response): Promise<Record<string, unknown>> {
  return (await response.json()) as Record<string, unknown>;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("BETTER_AUTH_SECRET", SECRET);
  vi.stubEnv("ARCHITECH_SUPER_ADMIN_PASSWORD_HASH", storedHash());
  vi.stubEnv("ARCHITECH_DATA_SOURCE", "prisma");
});
afterEach(() => vi.unstubAllEnvs());

async function signedInCookie(): Promise<string> {
  const response = await signInPost(
    new Request("http://localhost/api/auth/super/sign-in", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: PASSWORD }) }),
  );
  expect(response.status).toBe(200);
  const setCookie = response.headers.get("set-cookie") ?? "";
  const match = setCookie.match(/architech\.super_admin=([^;]+)/);
  if (!match) throw new Error(`no super-admin cookie in: ${setCookie}`);
  return match[1];
}

describe("POST /api/auth/super/sign-in", () => {
  it("503 when the hash is not configured", async () => {
    vi.stubEnv("ARCHITECH_SUPER_ADMIN_PASSWORD_HASH", "");
    const response = await signInPost(new Request("http://x/api/auth/super/sign-in", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: "whatever" }) }));
    expect(response.status).toBe(503);
    expect((await json(response)).error).toBe("SUPER_ADMIN_NOT_CONFIGURED");
  });

  it("401 with a uniform message on a wrong password", async () => {
    const response = await signInPost(new Request("http://x/api/auth/super/sign-in", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: "wrong" }) }));
    expect(response.status).toBe(401);
    expect((await json(response)).error).toBe("INVALID_CREDENTIALS");
  });

  it("200 + HttpOnly SameSite=Lax Max-Age=28800 cookie on success", async () => {
    const response = await signInPost(new Request("https://x.example/api/auth/super/sign-in", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: PASSWORD }) }));
    expect(response.status).toBe(200);
    const setCookie = response.headers.get("set-cookie") ?? "";
    expect(setCookie).toMatch(/Max-Age=28800/);
    expect(setCookie).toMatch(/HttpOnly/);
    expect(setCookie).toMatch(/SameSite=Lax/);
    expect(setCookie).toMatch(/Secure/);
  });
});

describe("admin plans routes", () => {
  it("403 for a session without admin.plans.read (demo broker)", async () => {
    const response = await plansGet(new Request("http://localhost/api/admin/plans"));
    expect(response.status).toBe(403);
  });

  it("503 in fixture mode even for the super admin", async () => {
    vi.stubEnv("ARCHITECH_DATA_SOURCE", "fixture");
    const cookie = await signedInCookie();
    const response = await plansGet(new Request("http://localhost/api/admin/plans", { headers: { cookie: `${SUPER_ADMIN_COOKIE}=${cookie}` } }));
    expect(response.status).toBe(503);
    expect((await json(response)).error).toBe("NOT_AVAILABLE_IN_FIXTURE_MODE");
  });

  it("GET lists plans and subscriptions for the super admin", async () => {
    const cookie = await signedInCookie();
    database.marketplacePlan.findMany.mockResolvedValue([{ id: "plan-1", code: "broker-pro", name: "Broker Pro", monthlyCredits: 0, teamSeats: 1 }]);
    database.marketplaceSubscription.findMany.mockResolvedValue([]);
    const response = await plansGet(new Request("http://localhost/api/admin/plans", { headers: { cookie: `${SUPER_ADMIN_COOKIE}=${cookie}` } }));
    expect(response.status).toBe(200);
    const body = await json(response);
    expect(body.ok).toBe(true);
    expect((body.plans as unknown[])).toHaveLength(1);
  });

  it("POST applies a plan and audits it", async () => {
    const cookie = await signedInCookie();
    database.user.findUnique.mockResolvedValue({ id: "user-1", brokerMemberships: [{ organization: { id: "org-1", name: "Nivasa", slug: "nivasa" } }] });
    database.marketplacePlan.findUnique.mockResolvedValue({ id: "plan-1", code: "broker-pro", name: "Broker Pro" });
    database.marketplaceSubscription.findFirst.mockResolvedValue(null);
    database.marketplaceSubscription.create.mockResolvedValue({ id: "sub-1", status: "TRIAL", expiresAt: null });
    const response = await plansPost(
      new Request("http://localhost/api/admin/plans", { method: "POST", headers: { "Content-Type": "application/json", cookie: `${SUPER_ADMIN_COOKIE}=${cookie}` }, body: JSON.stringify({ email: "owner@nivasa.in", planId: "plan-1", status: "TRIAL" }) }),
    );
    expect(response.status).toBe(200);
    const body = await json(response);
    expect(body).toMatchObject({ ok: true, previousStatus: null });
    expect(database.auditEvent.create).toHaveBeenCalled();
  });

  it("POST rejects an invalid status with 400", async () => {
    const cookie = await signedInCookie();
    const response = await plansPost(
      new Request("http://localhost/api/admin/plans", { method: "POST", headers: { "Content-Type": "application/json", cookie: `${SUPER_ADMIN_COOKIE}=${cookie}` }, body: JSON.stringify({ email: "owner@nivasa.in", planId: "plan-1", status: "FREE" }) }),
    );
    expect(response.status).toBe(400);
  });

  it("POST /definitions creates a plan and 409s a duplicate code", async () => {
    const cookie = await signedInCookie();
    database.marketplacePlan.findUnique.mockResolvedValue(null);
    database.marketplacePlan.create.mockResolvedValue({ id: "plan-9", code: "brokerage-team", name: "Brokerage Team" });
    const created = await definitionsPost(new Request("http://localhost/api/admin/plans/definitions", { method: "POST", headers: { "Content-Type": "application/json", cookie: `${SUPER_ADMIN_COOKIE}=${cookie}` }, body: JSON.stringify({ name: "Brokerage Team" }) }));
    expect(created.status).toBe(200);
    database.marketplacePlan.findUnique.mockResolvedValue({ id: "plan-1" });
    const duplicate = await definitionsPost(new Request("http://localhost/api/admin/plans/definitions", { method: "POST", headers: { "Content-Type": "application/json", cookie: `${SUPER_ADMIN_COOKIE}=${cookie}` }, body: JSON.stringify({ name: "Broker Pro" }) }));
    expect(duplicate.status).toBe(409);
  });
});

describe("POST /api/auth/super/sign-out", () => {
  it("clears the cookie and is idempotent", async () => {
    const response = await signOutPost(new Request("http://localhost/api/auth/super/sign-out", { method: "POST" }));
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toMatch(/Max-Age=0/);
  });
});
