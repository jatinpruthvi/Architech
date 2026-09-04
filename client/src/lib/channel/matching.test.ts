import { describe, expect, it } from "vitest";
import {
  BUDGET_TOLERANCE,
  MIN_SURFACED_SCORE,
  WEIGHTS,
  bandFor,
  matchDemandAgainstSupply,
  rejectionFor,
  scoreMatch,
  type DemandCriteria,
  type SupplyCandidate,
} from "./matching";

const NOW = new Date("2026-09-04T00:00:00.000Z");
const EARLIER = new Date("2026-09-01T00:00:00.000Z");

const demand = (over: Partial<DemandCriteria> = {}): DemandCriteria => ({
  requestId: "req_demand_1",
  organizationId: "org_buyer",
  intent: "BUY",
  cityId: "city_ahmedabad",
  localityId: "loc_thaltej",
  propertyType: "APARTMENT",
  budgetMinInr: 8_000_000,
  budgetMaxInr: 12_000_000,
  bhkMin: 3,
  bhkMax: 4,
  areaMinSqft: 1200,
  areaMaxSqft: 2000,
  createdAt: EARLIER,
  ...over,
});

const supply = (over: Partial<SupplyCandidate> = {}): SupplyCandidate => ({
  requestId: "req_supply_1",
  organizationId: "org_seller",
  listingId: "listing_1",
  intent: "BUY",
  cityId: "city_ahmedabad",
  localityId: "loc_thaltej",
  propertyType: "APARTMENT",
  priceInr: 11_000_000,
  bhk: 3,
  areaSqft: 1540,
  createdAt: EARLIER,
  verification: "RERA_VERIFIED",
  mediaCount: 6,
  ...over,
});

describe("hard filters", () => {
  it("accepts a well-formed cross-agency pair", () => {
    expect(rejectionFor(demand(), supply())).toBeNull();
  });

  it("never matches a brokerage with itself", () => {
    // Cross-agency is the entire point of the channel.
    expect(rejectionFor(demand({ organizationId: "org_x" }), supply({ organizationId: "org_x" })))
      .toBe("SAME_ORGANIZATION");
  });

  it("rejects a different city, intent or property type", () => {
    expect(rejectionFor(demand(), supply({ cityId: "city_surat" }))).toBe("CITY_MISMATCH");
    expect(rejectionFor(demand(), supply({ intent: "RENT" }))).toBe("INTENT_MISMATCH");
    expect(rejectionFor(demand(), supply({ propertyType: "VILLA" }))).toBe("PROPERTY_TYPE_MISMATCH");
  });

  it("rejects a different locality only when both sides name one", () => {
    expect(rejectionFor(demand(), supply({ localityId: "loc_bopal" }))).toBe("LOCALITY_MISMATCH");
    // A city-wide buyer should see everything in the city.
    expect(rejectionFor(demand({ localityId: null }), supply({ localityId: "loc_bopal" }))).toBeNull();
    expect(rejectionFor(demand(), supply({ localityId: null }))).toBeNull();
  });

  it("rejects BHK outside the requested range", () => {
    expect(rejectionFor(demand(), supply({ bhk: 1 }))).toBe("BHK_OUT_OF_RANGE");
    expect(rejectionFor(demand(), supply({ bhk: 6 }))).toBe("BHK_OUT_OF_RANGE");
  });

  it("allows a 10% stretch over budget but no more", () => {
    const max = 12_000_000;
    expect(rejectionFor(demand(), supply({ priceInr: Math.round(max * BUDGET_TOLERANCE) }))).toBeNull();
    expect(rejectionFor(demand(), supply({ priceInr: Math.round(max * BUDGET_TOLERANCE) + 1 })))
      .toBe("PRICE_OVER_BUDGET");
  });
});

describe("scoring", () => {
  it("sums its weights to exactly 100 so a score reads as a percentage", () => {
    expect(Object.values(WEIGHTS).reduce((a, b) => a + b, 0)).toBe(100);
  });

  it("is deterministic across repeated calls", () => {
    const a = scoreMatch(demand(), supply(), NOW);
    const b = scoreMatch(demand(), supply(), NOW);
    expect(a.score).toBe(b.score);
    expect(a.reasons).toEqual(b.reasons);
  });

  it("does not depend on the current time", () => {
    /* Recency is deliberately unscored. Two brokers looking at the same pair a
       week apart must see the same number, or they cannot discuss it. */
    const early = scoreMatch(demand(), supply(), new Date("2026-01-01T00:00:00Z"));
    const late = scoreMatch(demand(), supply(), new Date("2027-01-01T00:00:00Z"));
    expect(early.score).toBe(late.score);
  });

  it("scores an ideal pair as STRONG", () => {
    const result = scoreMatch(demand(), supply(), NOW);
    expect(result.score).toBeGreaterThanOrEqual(80);
    expect(result.band).toBe("STRONG");
  });

  it("explains every factor, and the points add up to the score", () => {
    const result = scoreMatch(demand(), supply(), NOW);
    expect(result.reasons.map((r) => r.factor)).toEqual([
      "locality", "propertyType", "budgetFit", "sizeFit", "listingQuality",
    ]);
    expect(result.reasons.reduce((t, r) => t + r.points, 0)).toBe(result.score);
    for (const reason of result.reasons) expect(reason.note).toBeTruthy();
  });

  it("never awards more points than a factor's weight", () => {
    const result = scoreMatch(demand(), supply(), NOW);
    for (const reason of result.reasons) {
      expect(reason.points).toBeLessThanOrEqual(reason.weight);
      expect(reason.points).toBeGreaterThanOrEqual(0);
    }
  });

  it("ranks an exact locality above a same-city fallback", () => {
    const exact = scoreMatch(demand(), supply(), NOW);
    const other = scoreMatch(demand({ localityId: null }), supply(), NOW);
    expect(exact.score).toBeGreaterThan(other.score);
  });

  it("prefers a property near the top of the budget over a much cheaper one", () => {
    // A 60L flat is usually a different segment from a 1.2Cr search.
    const near = scoreMatch(demand(), supply({ priceInr: 11_500_000 }), NOW);
    const far = scoreMatch(demand(), supply({ priceInr: 6_000_000 }), NOW);
    expect(near.score).toBeGreaterThan(far.score);
  });

  it("penalises an over-budget property smoothly rather than off a cliff", () => {
    const inside = scoreMatch(demand(), supply({ priceInr: 12_000_000 }), NOW);
    const slightly = scoreMatch(demand(), supply({ priceInr: 12_400_000 }), NOW);
    const nearLimit = scoreMatch(demand(), supply({ priceInr: 13_200_000 }), NOW);
    expect(inside.score).toBeGreaterThan(slightly.score);
    expect(slightly.score).toBeGreaterThan(nearLimit.score);
  });

  it("reports the overshoot percentage so the broker sees why", () => {
    const result = scoreMatch(demand(), supply({ priceInr: 13_200_000 }), NOW);
    expect(result.reasons.find((r) => r.factor === "budgetFit")?.note).toMatch(/10% over budget/);
  });

  /* The listing anchor, made visible: this is what rewards brokers for putting
     real, verified inventory on the public site. */
  it("ranks a verified listing with photos above a bare one at the same price", () => {
    const rich = scoreMatch(demand(), supply({ verification: "RERA_VERIFIED", mediaCount: 8 }), NOW);
    const bare = scoreMatch(demand(), supply({ verification: "DEMO", mediaCount: 0 }), NOW);
    expect(rich.score).toBeGreaterThan(bare.score);
    expect(rich.score - bare.score).toBe(WEIGHTS.listingQuality);
  });

  it("handles a listing with no BHK or area without crashing or zeroing", () => {
    const result = scoreMatch(demand(), supply({ bhk: null, areaSqft: null }), NOW);
    expect(result.score).toBeGreaterThan(0);
    expect(result.reasons.find((r) => r.factor === "sizeFit")?.note).toBe("No size criteria stated");
  });

  it("handles a demand with no budget stated", () => {
    const result = scoreMatch(demand({ budgetMinInr: null, budgetMaxInr: null }), supply(), NOW);
    expect(result.reasons.find((r) => r.factor === "budgetFit")?.note).toBe("No budget stated");
  });

  it("assigns bands at the documented thresholds", () => {
    expect(bandFor(100)).toBe("STRONG");
    expect(bandFor(80)).toBe("STRONG");
    expect(bandFor(79)).toBe("GOOD");
    expect(bandFor(60)).toBe("GOOD");
    expect(bandFor(59)).toBe("POSSIBLE");
    expect(bandFor(40)).toBe("POSSIBLE");
    expect(bandFor(39)).toBe("WEAK");
  });
});

describe("matching a demand against a pool", () => {
  it("returns only surfaceable matches, best first", () => {
    const results = matchDemandAgainstSupply(demand(), [
      supply({ requestId: "s_perfect" }),
      supply({ requestId: "s_other_city", cityId: "city_surat" }),
      supply({ requestId: "s_cheap", priceInr: 6_500_000, verification: "DEMO", mediaCount: 0 }),
    ], NOW);

    expect(results.map((r) => r.supplyRequestId)).not.toContain("s_other_city");
    expect(results[0].supplyRequestId).toBe("s_perfect");
    for (const r of results) expect(r.score).toBeGreaterThanOrEqual(MIN_SURFACED_SCORE);
  });

  it("excludes the requesting brokerage's own inventory", () => {
    const results = matchDemandAgainstSupply(demand({ organizationId: "org_a" }), [
      supply({ requestId: "s_own", organizationId: "org_a" }),
      supply({ requestId: "s_other", organizationId: "org_b" }),
    ], NOW);
    expect(results.map((r) => r.supplyRequestId)).toEqual(["s_other"]);
  });

  it("breaks ties stably so ordering does not shuffle between page loads", () => {
    const pool = [supply({ requestId: "s_b" }), supply({ requestId: "s_a" })];
    const first = matchDemandAgainstSupply(demand(), pool, NOW).map((r) => r.supplyRequestId);
    const second = matchDemandAgainstSupply(demand(), [...pool].reverse(), NOW).map((r) => r.supplyRequestId);
    expect(first).toEqual(second);
    expect(first).toEqual(["s_a", "s_b"]);
  });

  it("carries both organization ids so the match row can be written directly", () => {
    const [match] = matchDemandAgainstSupply(demand(), [supply()], NOW);
    expect(match.demandOrganizationId).toBe("org_buyer");
    expect(match.supplyOrganizationId).toBe("org_seller");
  });

  it("returns nothing rather than throwing on an empty pool", () => {
    expect(matchDemandAgainstSupply(demand(), [], NOW)).toEqual([]);
  });
});
