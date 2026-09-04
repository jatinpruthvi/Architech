import { beforeEach, describe, expect, it } from "vitest";
import { acceptChannelMatch, channelDashboard, closeChannelDeal, confirmChannelDeal, createChannelRequest, listChannelMatches, listChannelNotifications, listPendingErpnextCloseWritesForTests, publishChannelRequest, resetBrokerChannelForTests, saveChannelDealSplit, sanitizeChannelSummary } from "./channel";
import type { AuthOrganization, AuthSession } from "@/lib/auth/roles";

function session(organizationId: string, verificationStatus: AuthOrganization["verificationStatus"] = "VERIFIED_PARTNER"): AuthSession {
  return {
    user: { id: `user-${organizationId}`, name: `User ${organizationId}`, email: `${organizationId}@example.com`, role: "BROKER_ADMIN", listerType: "BROKER" },
    organization: { id: organizationId, slug: organizationId, name: organizationId, verificationStatus },
    permissions: ["broker.dashboard.read", "broker.channel.read", "broker.channel.write"],
    source: "better-auth-contract-demo",
  };
}

const demand = {
  type: "DEMAND" as const,
  cityId: "city-ahmedabad",
  localitySlug: "thaltej",
  intent: "BUY",
  propertyType: "APARTMENT",
  bhkMin: 3,
  bhkMax: 3,
  areaMinSqft: 1300,
  areaMaxSqft: 1700,
  budgetMinInr: 10_000_000,
  budgetMaxInr: 12_000_000,
  sourceRequirementId: "private-requirement-1",
};

const supply = {
  type: "SUPPLY" as const,
  cityId: "city-ahmedabad",
  localitySlug: "thaltej",
  intent: "BUY",
  propertyType: "APARTMENT",
  bhkMin: 3,
  bhkMax: 3,
  areaMinSqft: 1450,
  areaMaxSqft: 1550,
  priceInr: 11_200_000,
  sourceListingId: "private-listing-1",
};

describe("broker channel", () => {
  beforeEach(resetBrokerChannelForTests);

  it("rejects contact-like data in sanitized summaries", () => {
    const result = sanitizeChannelSummary({ ...demand, detailSummary: "Call buyer on 9876543210" });
    expect(result.ok).toBe(false);
  });

  it("creates deterministic cross-org matches and hides private source refs", () => {
    const orgA = session("org-a");
    const orgB = session("org-b");
    const createdDemand = createChannelRequest(demand, orgA);
    const createdSupply = createChannelRequest(supply, orgB);
    expect(createdDemand.ok && createdSupply.ok).toBe(true);
    if (!createdDemand.ok || !createdSupply.ok) throw new Error("fixture setup failed");

    expect(publishChannelRequest(createdDemand.request.id, orgA).ok).toBe(true);
    const publishedSupply = publishChannelRequest(createdSupply.request.id, orgB);
    expect(publishedSupply.ok && publishedSupply.matches).toHaveLength(1);

    const orgAMatches = listChannelMatches(orgA);
    expect(orgAMatches.ok && orgAMatches.matches[0]?.score).toBeGreaterThanOrEqual(80);
    if (!orgAMatches.ok) throw new Error("match list failed");
    expect(JSON.stringify(orgAMatches.matches)).not.toContain("private-requirement-1");
    expect(JSON.stringify(orgAMatches.matches)).not.toContain("private-listing-1");
  });


  it("requires supply requests to be generated from a source listing", () => {
    const org = session("org-a");
    const result = createChannelRequest({ ...supply, sourceListingId: null }, org);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.errors[0]).toContain("existing listing");
  });



  it("requires demand requests to be generated from a source requirement", () => {
    const org = session("org-a");
    const result = createChannelRequest({ ...demand, sourceRequirementId: null }, org);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.errors[0]).toContain("buyer requirement");
  });

  it("prevents duplicate supply requests for the same listing", () => {
    const org = session("org-a");
    const first = createChannelRequest(supply, org);
    const second = createChannelRequest(supply, org);
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(false);
    expect(!second.ok && second.status).toBe(409);
  });


  it("creates and lists only top broker-channel matches", () => {
    const orgA = session("org-a");
    const createdDemand = createChannelRequest(demand, orgA);
    expect(createdDemand.ok).toBe(true);
    if (!createdDemand.ok) throw new Error("demand setup failed");
    for (let index = 0; index < 12; index += 1) {
      const org = session(`org-supply-${index}`);
      const createdSupply = createChannelRequest({ ...supply, sourceListingId: `private-listing-${index}`, priceInr: 10_500_000 + index * 25_000 }, org);
      expect(createdSupply.ok).toBe(true);
      if (!createdSupply.ok) throw new Error("supply setup failed");
      publishChannelRequest(createdSupply.request.id, org);
    }
    const published = publishChannelRequest(createdDemand.request.id, orgA);
    expect(published.ok && published.matches).toHaveLength(10);
    const matches = listChannelMatches(orgA);
    expect(matches.ok && matches.matches).toHaveLength(10);
    if (!matches.ok) throw new Error("match list failed");
    expect(matches.matches[0].score).toBeGreaterThanOrEqual(matches.matches[9].score);
  });

  it("blocks unverified organizations from publishing", () => {
    const unverified = session("org-unverified", "SOURCE_REVIEWED");
    const created = createChannelRequest(demand, unverified);
    expect(created.ok).toBe(true);
    if (!created.ok) throw new Error("fixture setup failed");
    const result = publishChannelRequest(created.request.id, unverified);
    expect(result.ok).toBe(false);
  });

  it("accepts a match, validates split, and dual-closes with idempotent close", () => {
    const orgA = session("org-a");
    const orgB = session("org-b");
    const createdDemand = createChannelRequest(demand, orgA);
    const createdSupply = createChannelRequest(supply, orgB);
    if (!createdDemand.ok || !createdSupply.ok) throw new Error("fixture setup failed");
    publishChannelRequest(createdDemand.request.id, orgA);
    const publishResult = publishChannelRequest(createdSupply.request.id, orgB);
    if (!publishResult.ok) throw new Error("match setup failed");

    const accepted = acceptChannelMatch(publishResult.matches[0].id, orgA);
    expect(accepted.ok).toBe(true);
    if (!accepted.ok) throw new Error("accept failed");

    const badSplit = saveChannelDealSplit(accepted.deal.id, { totalCommissionInr: 500_000, demandBrokerShareInr: 200_000, supplyBrokerShareInr: 200_000 }, orgA);
    expect(badSplit.ok).toBe(false);

    const split = saveChannelDealSplit(accepted.deal.id, { totalCommissionInr: 500_000, demandBrokerShareInr: 250_000, supplyBrokerShareInr: 250_000, closeMode: "DUAL" }, orgA);
    expect(split.ok).toBe(true);

    const firstConfirm = confirmChannelDeal(accepted.deal.id, orgA);
    expect(firstConfirm.ok && firstConfirm.deal.status).toBe("PENDING_OTHER_CLOSE");
    const secondConfirm = confirmChannelDeal(accepted.deal.id, orgB);
    expect(secondConfirm.ok && secondConfirm.deal.status).toBe("CLOSED");
    const duplicateClose = closeChannelDeal(accepted.deal.id, orgB);
    expect(duplicateClose.ok && duplicateClose.deal.status).toBe("CLOSED");
    expect(listPendingErpnextCloseWritesForTests()).toHaveLength(2);
    const notifications = listChannelNotifications(orgA);
    expect(notifications.ok && notifications.notifications.some((notification) => notification.eventType === "channel.deal.closed")).toBe(true);
    const dashboard = channelDashboard(orgA);
    expect(dashboard.ok && dashboard.dashboard.unreadNotifications).toBeGreaterThan(0);
  });
});
