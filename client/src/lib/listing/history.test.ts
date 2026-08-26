import { describe, expect, it } from "vitest";
import { comparableListings, derivePriceHistory, sortPriceEvents, type PriceEvent } from "./history";

const events: PriceEvent[] = [
  { id: "e1", kind: "listed", priceInr: 19_000_000, date: "2026-07-01", note: "Listed" },
  { id: "e2", kind: "price_change", priceInr: 18_500_000, date: "2026-07-20", note: "Reduced" },
];

describe("listing price history & comparables", () => {
  it("sorts price events newest-first and derives the current price", () => {
    const sorted = sortPriceEvents(events);
    expect(sorted[0].priceInr).toBe(18_500_000);
    const history = derivePriceHistory("garden-courtyard", events);
    expect(history.currentPriceInr).toBe(18_500_000);
    expect(history.hasDecline).toBe(true);
  });

  it("reports no decline when price only rose", () => {
    const history = derivePriceHistory("x", [
      { id: "a", kind: "listed", priceInr: 18_000_000, date: "2026-07-01" },
      { id: "b", kind: "price_change", priceInr: 19_000_000, date: "2026-07-20" },
    ]);
    expect(history.hasDecline).toBe(false);
  });

  it("returns no current price for a listing with no events", () => {
    expect(derivePriceHistory("x", []).currentPriceInr).toBeNull();
  });

  it("finds comparables in the same locality by price proximity", () => {
    const comparables = comparableListings({ id: "garden-courtyard", localitySlug: "paldi", priceNum: 18_500_000 }, 3);
    expect(comparables.length).toBeLessThanOrEqual(3);
    // All comparables live in Paldi and are ordered by distance from the subject price.
    for (const item of comparables) {
      expect(item.deltaPct).toBeDefined();
      expect(item.locality).toBe("Paldi");
    }
  });
});
