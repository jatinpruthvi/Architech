import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const database = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  marketplacePlan: { findUnique: vi.fn(), findMany: vi.fn(), count: vi.fn(), create: vi.fn() },
  marketplaceSubscription: { findFirst: vi.fn(), findMany: vi.fn(), update: vi.fn(), create: vi.fn() },
  auditEvent: { create: vi.fn() },
  $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(database)),
}));

vi.mock("@/lib/repositories/server/prisma", () => ({ getPrismaClient: () => database }));
import { applyPlanToOrganization, createPlanDefinition, effectiveAdminPlanStatus, lookupOrganizationForLogin } from "./admin";

const ORG = { id: "org-1", name: "Nivasa Partners", slug: "nivasa-partners", cityId: "city-ahmedabad" };
const USER_ROW = (email: string) => ({ id: "user-1", name: "Owner Person", email, role: "BROKER_ADMIN", brokerMemberships: [{ organizationId: ORG.id, organization: ORG }] });

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.unstubAllEnvs());

describe("lookupOrganizationForLogin", () => {
  it("resolves the login id (email) to its organization and current plan", async () => {
    database.user.findUnique.mockResolvedValue(USER_ROW("owner@nivasa.in"));
    database.marketplaceSubscription.findFirst.mockResolvedValue({ id: "sub-1", status: "TRIAL", expiresAt: new Date("2026-10-01T00:00:00Z"), plan: { name: "Broker Pro", code: "broker-pro" } });
    const result = await lookupOrganizationForLogin(database, "OWNER@nivasa.in");
    expect(result).toMatchObject({ found: true, organization: { id: "org-1", slug: "nivasa-partners" }, currentSubscription: { status: "TRIAL" } });
    expect(database.user.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { email: "owner@nivasa.in" } }));
  });

  it("unknown email and email-without-organization are both uniform not-found", async () => {
    database.user.findUnique.mockResolvedValue(null);
    expect(await lookupOrganizationForLogin(database, "ghost@example.com")).toEqual({ found: false });
    database.user.findUnique.mockResolvedValue({ id: "user-2", name: "Buyer", email: "buyer@example.com", role: "BUYER", brokerMemberships: [] });
    expect(await lookupOrganizationForLogin(database, "buyer@example.com")).toEqual({ found: false });
  });
});

describe("effectiveAdminPlanStatus", () => {
  it("matches the effective server gate for a date-lapsed active plan", () => {
    const now = new Date("2026-09-12T12:00:00.000Z").getTime();
    expect(effectiveAdminPlanStatus("ACTIVE", new Date("2026-09-12T11:59:59.999Z"), now)).toBe("EXPIRED");
    expect(effectiveAdminPlanStatus("ACTIVE", new Date("2026-09-12T12:00:00.001Z"), now)).toBe("ACTIVE");
    expect(effectiveAdminPlanStatus("PAUSED", new Date("2026-09-12T11:00:00.000Z"), now)).toBe("PAUSED");
  });
});

describe("applyPlanToOrganization", () => {
  it("creates a subscription for an org with none and audits the change", async () => {
    database.user.findUnique.mockResolvedValue(USER_ROW("owner@nivasa.in"));
    database.marketplacePlan.findUnique.mockResolvedValue({ id: "plan-1", code: "broker-pro", name: "Broker Pro" });
    database.marketplaceSubscription.findFirst.mockResolvedValue(null);
    database.marketplaceSubscription.create.mockResolvedValue({ id: "sub-new", status: "ACTIVE", expiresAt: null });
    const result = await applyPlanToOrganization(database, { email: "owner@nivasa.in", planId: "plan-1", status: "ACTIVE", expiresAt: null, ipHash: "ip-hash-1" });
    expect(result).toMatchObject({ ok: true, previousStatus: null, subscription: { id: "sub-new", status: "ACTIVE" } });
    expect(database.marketplaceSubscription.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ organizationId: "org-1", planId: "plan-1", status: "ACTIVE" }) }));
    expect(database.auditEvent.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: "admin.plan.updated", metadata: expect.objectContaining({ loginEmail: "owner@nivasa.in", previousStatus: null, status: "ACTIVE" }) }) }));
  });

  it("updates the most recent subscription and records the previous status", async () => {
    database.user.findUnique.mockResolvedValue(USER_ROW("owner@nivasa.in"));
    database.marketplacePlan.findUnique.mockResolvedValue({ id: "plan-1", code: "broker-pro", name: "Broker Pro" });
    database.marketplaceSubscription.findFirst.mockResolvedValue({ id: "sub-1", status: "TRIAL" });
    database.marketplaceSubscription.update.mockResolvedValue({ id: "sub-1", status: "EXPIRED", expiresAt: null });
    const result = await applyPlanToOrganization(database, { email: "owner@nivasa.in", planId: "plan-1", status: "EXPIRED", expiresAt: new Date("2026-09-01T00:00:00Z"), ipHash: "ip-hash-1" });
    expect(result).toMatchObject({ ok: true, previousStatus: "TRIAL", subscription: { status: "EXPIRED", expiresAt: null } });
    expect(database.marketplaceSubscription.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "EXPIRED", expiresAt: null }) }));
    expect(database.marketplaceSubscription.create).not.toHaveBeenCalled();
  });

  it("persists a future expiry date for an active plan", async () => {
    database.user.findUnique.mockResolvedValue(USER_ROW("owner@nivasa.in"));
    database.marketplacePlan.findUnique.mockResolvedValue({ id: "plan-1", code: "broker-pro", name: "Broker Pro" });
    database.marketplaceSubscription.findFirst.mockResolvedValue(null);
    const expiresAt = new Date("2099-01-01T23:59:59.999Z");
    database.marketplaceSubscription.create.mockResolvedValue({ id: "sub-future", status: "ACTIVE", expiresAt });

    const result = await applyPlanToOrganization(database, { email: "owner@nivasa.in", planId: "plan-1", status: "ACTIVE", expiresAt, ipHash: "ip" });
    expect(result).toMatchObject({ ok: true, subscription: { status: "ACTIVE", expiresAt: expiresAt.toISOString() } });
    expect(database.marketplaceSubscription.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "ACTIVE", expiresAt }) }));
  });

  it("rejects a past expiry for active or trial plans before writing", async () => {
    const result = await applyPlanToOrganization(database, { email: "owner@nivasa.in", planId: "plan-1", status: "ACTIVE", expiresAt: new Date(Date.now() - 1), ipHash: "ip" });
    expect(result).toEqual({ ok: false, error: "EXPIRY_INVALID" });
    expect(database.user.findUnique).not.toHaveBeenCalled();
  });

  it("seeds the default Broker Pro plan when the plan table is empty", async () => {
    database.user.findUnique.mockResolvedValue(USER_ROW("owner@nivasa.in"));
    database.marketplacePlan.findUnique.mockResolvedValue(null);
    database.marketplacePlan.count.mockResolvedValue(0);
    database.marketplacePlan.create.mockResolvedValue({ id: "plan-seed", code: "broker-pro", name: "Broker Pro" });
    database.marketplaceSubscription.findFirst.mockResolvedValue(null);
    database.marketplaceSubscription.create.mockResolvedValue({ id: "sub-2", status: "TRIAL", expiresAt: null });
    const result = await applyPlanToOrganization(database, { email: "owner@nivasa.in", planId: undefined, status: "TRIAL", expiresAt: null, ipHash: "ip" });
    expect(result).toMatchObject({ ok: true, subscription: { id: "sub-2" } });
    expect(database.marketplacePlan.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ code: "broker-pro", name: "Broker Pro" }) }));
  });

  it("a planId that does not exist while plans exist is PLAN_NOT_FOUND", async () => {
    database.user.findUnique.mockResolvedValue(USER_ROW("owner@nivasa.in"));
    database.marketplacePlan.findUnique.mockResolvedValue(null);
    database.marketplacePlan.count.mockResolvedValue(3);
    expect(await applyPlanToOrganization(database, { email: "owner@nivasa.in", planId: "ghost", status: "ACTIVE", expiresAt: null, ipHash: "ip" })).toEqual({ ok: false, error: "PLAN_NOT_FOUND" });
  });

  it("unknown login id is ORG_NOT_FOUND and never writes", async () => {
    database.user.findUnique.mockResolvedValue(null);
    const result = await applyPlanToOrganization(database, { email: "ghost@example.com", planId: "plan-1", status: "ACTIVE", expiresAt: null, ipHash: "ip" });
    expect(result).toEqual({ ok: false, error: "ORG_NOT_FOUND" });
    expect(database.marketplaceSubscription.create).not.toHaveBeenCalled();
    expect(database.marketplaceSubscription.update).not.toHaveBeenCalled();
  });
});

describe("createPlanDefinition", () => {
  it("creates a plan with a slugified code and audits it", async () => {
    database.marketplacePlan.findUnique.mockResolvedValue(null);
    database.marketplacePlan.create.mockResolvedValue({ id: "plan-9", code: "brokerage-team", name: "Brokerage Team" });
    const result = await createPlanDefinition(database, { name: "Brokerage Team", ipHash: "ip" });
    expect(result).toMatchObject({ ok: true, plan: { code: "brokerage-team" } });
  });

  it("rejects short names and duplicate codes", async () => {
    expect(await createPlanDefinition(database, { name: "x", ipHash: "ip" })).toEqual({ ok: false, error: "NAME_INVALID" });
    database.marketplacePlan.findUnique.mockResolvedValue({ id: "plan-1" });
    expect(await createPlanDefinition(database, { name: "Broker Pro", ipHash: "ip" })).toEqual({ ok: false, error: "CODE_TAKEN" });
  });
});
