import { describe, expect, it } from "vitest";
import {
  BROKER_NOTE_MAX,
  canTransition,
  decideDemandPublish,
  decideSupplyPublish,
  defaultExpiry,
  describeFailure,
  isDiscoverable,
  isTerminal,
  validateDemandInput,
  validateSupplyInput,
  type ChannelRequestStatus,
  type DemandRequestInput,
  type SupplyRequestInput,
} from "./request";
import type { ListingSnapshot, OrganizationSnapshot } from "./publish";

const org = (over: Partial<OrganizationSnapshot> = {}): OrganizationSnapshot => ({
  id: "org_a",
  name: "Skyline Realty",
  verificationStatus: "RERA_VERIFIED",
  businessPhoneE164: "+919876543210",
  businessPhoneVerifiedAt: new Date("2026-08-01T00:00:00Z"),
  ...over,
});

const listing = (over: Partial<ListingSnapshot> = {}): ListingSnapshot => ({
  id: "listing_1",
  lifecycle: "ACTIVE",
  brokerOrgId: "org_a",
  cityId: "city_1",
  localityId: "loc_1",
  propertyType: "APARTMENT",
  priceInr: 11_000_000,
  bhk: 3,
  areaSqft: 1540,
  mediaCount: 4,
  verification: "RERA_VERIFIED",
  ...over,
});

const demand = (over: Partial<DemandRequestInput> = {}): DemandRequestInput => ({
  intent: "BUY",
  cityId: "city_1",
  propertyType: "APARTMENT",
  budgetMaxInr: 12_000_000,
  ...over,
});

const supply = (over: Partial<SupplyRequestInput> = {}): SupplyRequestInput => ({
  intent: "BUY",
  listingId: "listing_1",
  ...over,
});


describe("expiry", () => {
  it("defaults to 30 days out", () => {
    expect(defaultExpiry(new Date("2026-09-04T00:00:00Z")).toISOString()).toBe("2026-10-04T00:00:00.000Z");
  });

  it("honours a caller-chosen window", () => {
    expect(defaultExpiry(new Date("2026-09-04T00:00:00Z"), 7).toISOString()).toBe("2026-09-11T00:00:00.000Z");
  });
});

describe("request lifecycle", () => {
  it("treats only open and matched requests as discoverable", () => {
    // A half-written draft must never appear in another agency's search.
    expect(isDiscoverable("OPEN")).toBe(true);
    expect(isDiscoverable("MATCHED")).toBe(true);
    for (const s of ["DRAFT", "CLOSED", "CANCELLED", "EXPIRED"] as ChannelRequestStatus[]) {
      expect(isDiscoverable(s)).toBe(false);
    }
  });

  it("allows publishing and cancelling a draft", () => {
    expect(canTransition("DRAFT", "OPEN")).toBe(true);
    expect(canTransition("DRAFT", "CANCELLED")).toBe(true);
  });

  it("refuses to jump straight from draft to matched", () => {
    expect(canTransition("DRAFT", "MATCHED")).toBe(false);
  });

  it("lets a matched request fall back to open when every match is declined", () => {
    // Otherwise a request stays stuck looking busy with no live matches.
    expect(canTransition("MATCHED", "OPEN")).toBe(true);
  });

  it("makes closed, cancelled and expired final", () => {
    /* Reopening would resurrect matches whose counterparty has moved on; the
       broker publishes a fresh request instead. */
    for (const s of ["CLOSED", "CANCELLED", "EXPIRED"] as ChannelRequestStatus[]) {
      expect(isTerminal(s)).toBe(true);
      expect(canTransition(s, "OPEN")).toBe(false);
    }
  });
});

describe("demand input validation", () => {
  it("accepts a well-formed requirement", () => {
    expect(validateDemandInput(demand())).toEqual({ ok: true });
  });

  it("requires a city and a property type", () => {
    const result = validateDemandInput(demand({ cityId: "", propertyType: "" }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toEqual(["City is required.", "Property type is required."]);
    }
  });

  it("rejects an inverted range rather than silently swapping it", () => {
    // Swapping would be guessing at intent; the broker should see the typo.
    const result = validateDemandInput(demand({ budgetMinInr: 20_000_000, budgetMaxInr: 5_000_000 }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]).toMatch(/Budget minimum cannot be greater/);
  });

  it("accepts an open-ended range, which is a real requirement", () => {
    expect(validateDemandInput(demand({ bhkMin: 3, bhkMax: null })).ok).toBe(true);
    expect(validateDemandInput(demand({ budgetMinInr: null, budgetMaxInr: 9_000_000 })).ok).toBe(true);
  });

  it("rejects negative and non-finite numbers", () => {
    expect(validateDemandInput(demand({ areaMinSqft: -5 })).ok).toBe(false);
    expect(validateDemandInput(demand({ budgetMaxInr: Number.NaN })).ok).toBe(false);
  });

  it("rejects an unknown intent", () => {
    expect(validateDemandInput(demand({ intent: "LEASE" as never })).ok).toBe(false);
  });

  it("caps the note at the column width", () => {
    // Longer text would be truncated by the database, losing the broker's words.
    expect(validateDemandInput(demand({ brokerNote: "x".repeat(BROKER_NOTE_MAX) })).ok).toBe(true);
    expect(validateDemandInput(demand({ brokerNote: "x".repeat(BROKER_NOTE_MAX + 1) })).ok).toBe(false);
  });

  it("bounds the expiry window", () => {
    expect(validateDemandInput(demand({ expiryDays: 0 })).ok).toBe(false);
    expect(validateDemandInput(demand({ expiryDays: 91 })).ok).toBe(false);
    expect(validateDemandInput(demand({ expiryDays: 45 })).ok).toBe(true);
  });
});

describe("supply input validation", () => {
  it("accepts an offer that names a listing", () => {
    expect(validateSupplyInput(supply())).toEqual({ ok: true });
  });

  it("refuses an offer with no listing behind it", () => {
    // The listing anchor is the point of the design.
    const result = validateSupplyInput(supply({ listingId: "" }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]).toMatch(/listing is required/i);
  });
});

describe("publish decisions carry the right status code", () => {
  it("passes a verified agency with a good requirement", () => {
    expect(decideDemandPublish(demand(), org())).toEqual({ ok: true });
  });

  it("passes a verified agency offering its own active listing", () => {
    expect(decideSupplyPublish(supply(), org(), listing())).toEqual({ ok: true });
  });

  it("returns 403, not 400, when the agency itself may not trade", () => {
    // "Bad request" would send an unverified broker hunting for a form error.
    const result = decideDemandPublish(demand(), org({ verificationStatus: "DEMO" }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(403);
  });

  it("returns 400 for a fixable listing problem", () => {
    const result = decideSupplyPublish(supply(), org(), listing({ mediaCount: 0 }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(400);
  });

  it("reports a missing listing as 404, not 403", () => {
    /* A 403 would confirm the id exists and belongs to someone else, letting
       the channel be used to probe for listing ids. */
    const result = decideSupplyPublish(supply(), org(), null);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(404);
  });

  it("reports another agency's listing the same way as a missing one", () => {
    const result = decideSupplyPublish(supply(), org(), listing({ brokerOrgId: "org_other" }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(403);
  });

  it("reports form problems alone, before the verification gates", () => {
    // Two unrelated problems in one toast is how brokers learn to ignore them.
    const result = decideDemandPublish(demand({ intent: "NOPE" as never }), org({ verificationStatus: "DEMO" }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toEqual(["Intent must be BUY or RENT."]);
  });

  it("blocks a note carrying a customer number", () => {
    const result = decideDemandPublish(demand({ brokerNote: "buyer on 9876543210" }), org());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]).toMatch(/Remove phone numbers/);
  });

  it("explains every failure in terms of the fix", () => {
    for (const code of [
      "ORG_NOT_VERIFIED", "ORG_HAS_NO_VERIFIED_PHONE", "LISTING_NOT_ACTIVE",
      "LISTING_HAS_NO_PHOTOS", "DEMAND_REQUIRES_BUDGET", "NOTE_CONTAINS_CONTACT_DETAILS",
    ]) {
      // A raw code tells a broker nothing about what to do next.
      expect(describeFailure(code)).not.toBe(code);
      expect(describeFailure(code).length).toBeGreaterThan(20);
    }
  });

  it("falls back to a safe message for an unknown code", () => {
    expect(describeFailure("SOMETHING_NEW")).toMatch(/cannot be published/);
  });
});
