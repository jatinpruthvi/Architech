import { beforeEach, describe, expect, it, vi } from "vitest";

/* The listings repository is mocked rather than used: in the current fixture
   all 336 listings sit in distinct localities, so getListingsByLocality never
   returns more than one row and comparableListings always yields []. Testing
   against the real repository would make every assertion here pass vacuously.
   (That fixture shape is itself worth flagging to the data owner — the
   "comparable homes" surface cannot render with it — but inventing listings to
   make a test look meaningful would be worse.) */
const peers = vi.hoisted(() => ({ current: [] as unknown[] }));

vi.mock("@/lib/repositories/listings", () => ({
  getListingsByLocality: () => peers.current,
}));

import { comparableListings } from "./comparables";

function listing(id: string, priceNum: number) {
  return {
    id,
    title: `Home ${id}`,
    priceNum,
    locality: "Test Locality",
    localitySlug: "test-locality",
    areaNum: 1200,
    pricePerSqft: "₹5,000",
    badge: "NEW",
  };
}

const SUBJECT = { id: "subject", localitySlug: "test-locality", priceNum: 10_000_000 };

beforeEach(() => {
  peers.current = [];
});

describe("comparableListings", () => {
  it("excludes the subject listing itself", () => {
    peers.current = [listing("subject", 10_000_000), listing("peer-a", 11_000_000)];
    expect(comparableListings(SUBJECT, 10).map((c) => c.id)).toEqual(["peer-a"]);
  });

  it("excludes peers with a non-positive price", () => {
    peers.current = [listing("zero", 0), listing("negative", -5), listing("ok", 9_000_000)];
    expect(comparableListings(SUBJECT, 10).map((c) => c.id)).toEqual(["ok"]);
  });

  it("orders by price proximity to the subject", () => {
    peers.current = [
      listing("far", 30_000_000),
      listing("near", 10_500_000),
      listing("mid", 14_000_000),
    ];
    expect(comparableListings(SUBJECT, 10).map((c) => c.id)).toEqual(["near", "mid", "far"]);
  });

  it("respects the limit after sorting", () => {
    peers.current = [
      listing("far", 30_000_000),
      listing("near", 10_500_000),
      listing("mid", 14_000_000),
    ];
    expect(comparableListings(SUBJECT, 2).map((c) => c.id)).toEqual(["near", "mid"]);
  });

  it("computes deltaPct as a rounded signed percentage against the subject", () => {
    peers.current = [listing("up", 12_000_000), listing("down", 8_000_000)];
    const result = comparableListings(SUBJECT, 10);
    expect(result.find((c) => c.id === "up")?.deltaPct).toBe(20);
    expect(result.find((c) => c.id === "down")?.deltaPct).toBe(-20);
  });

  it("returns an empty list when there are no peers", () => {
    expect(comparableListings(SUBJECT, 5)).toEqual([]);
  });

  /* W2 (round-4 watchlist), now fixed. The peer filter checked
     `listing.priceNum > 0` but nothing checked the SUBJECT's price, so a
     subject priced 0 divided by zero: deltaPct became Infinity, which
     ListingPage.tsx renders as "Infinity% vs this home".

     The fix returns null, matching the convention already used in
     realestate/locality-intel.ts:32 and realestate/market-trends.ts:40, whose
     consumers render "—" for a null delta. Returning 0 was rejected: it would
     assert the comparables are priced the same as the subject, which is not
     known, and inventing that value is what the watchlist note warned against. */
  it("does not divide by zero when the subject price is zero", () => {
    peers.current = [listing("peer-a", 10_000_000)];
    const result = comparableListings({ ...SUBJECT, priceNum: 0 }, 10);
    expect(result).toHaveLength(1);
    expect(result[0].deltaPct).toBeNull();
  });

  it("does not divide by a negative subject price either", () => {
    peers.current = [listing("peer-a", 10_000_000)];
    const result = comparableListings({ ...SUBJECT, priceNum: -1 }, 10);
    expect(result[0].deltaPct).toBeNull();
  });

  it("still returns peers for a zero-priced subject rather than dropping them", () => {
    peers.current = [listing("peer-a", 10_000_000), listing("peer-b", 20_000_000)];
    expect(comparableListings({ ...SUBJECT, priceNum: 0 }, 10)).toHaveLength(2);
  });
});
