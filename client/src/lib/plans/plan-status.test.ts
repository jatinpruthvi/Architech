import { describe, expect, it, vi, type Mock } from "vitest";

const database = vi.hoisted(() => ({
  marketplaceSubscription: { findFirst: vi.fn() as Mock },
}));

vi.mock("@/lib/repositories/server/prisma", () => ({ getPrismaClient: () => database }));

import { resolvePlanStatusForOrg } from "./plan-status";

vi.stubEnv("ARCHITECH_DATA_SOURCE", "prisma");

describe("resolvePlanStatusForOrg", () => {
  it("honors an explicit env override regardless of source", async () => {
    vi.stubEnv("ARCHITECH_BROKER_PLAN_STATUS", "ACTIVE");
    expect(await resolvePlanStatusForOrg("org_a")).toBe("ACTIVE");
    expect(database.marketplaceSubscription.findFirst).not.toHaveBeenCalled();
    vi.unstubAllEnvs();
    vi.stubEnv("ARCHITECH_DATA_SOURCE", "prisma");
  });

  it("returns ACTIVE in fixture mode without touching prisma", async () => {
    vi.stubEnv("ARCHITECH_DATA_SOURCE", "demo");
    expect(await resolvePlanStatusForOrg("org_a")).toBe("ACTIVE");
    expect(database.marketplaceSubscription.findFirst).not.toHaveBeenCalled();
  });

  it("maps the most recent prisma subscription: TRIAL/ACTIVE pass, PAUSED/EXPIRED/CANCELLED are EXPIRED, none is NONE", async () => {
    vi.stubEnv("ARCHITECH_DATA_SOURCE", "prisma");
    // prisma applies orderBy (spec §3: startsAt desc, then id desc) — the
    // mock returns the row prisma would hand back first.
    database.marketplaceSubscription.findFirst.mockResolvedValueOnce({ status: "PAUSED", startsAt: new Date("2026-01-05"), id: "sub-2" });
    expect(await resolvePlanStatusForOrg("org_a")).toBe("EXPIRED");
    expect(database.marketplaceSubscription.findFirst).toHaveBeenCalledWith({
      where: { organizationId: "org_a" },
      orderBy: [{ startsAt: "desc" }, { id: "desc" }],
    });

    database.marketplaceSubscription.findFirst.mockResolvedValueOnce(null);
    expect(await resolvePlanStatusForOrg("org_none")).toBe("NONE");

    database.marketplaceSubscription.findFirst.mockResolvedValueOnce({ status: "TRIAL", startsAt: new Date(), id: "sub-3" });
    expect(await resolvePlanStatusForOrg("org_t")).toBe("TRIAL");

    database.marketplaceSubscription.findFirst.mockResolvedValueOnce(null);
    vi.stubEnv("ARCHITECH_DATA_SOURCE", "demo");
    expect(await resolvePlanStatusForOrg("org_fixture")).toBe("ACTIVE");
  });
});
