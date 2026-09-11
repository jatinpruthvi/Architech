import { describe, expect, it } from "vitest";
import { formatPrice, formatRent, generatedListings } from "./property-generator";

/* The price formatters are the single source of visible price labels for the
   generated inventory AND (since the broker-store DB upsert was fixed to use
   them) for broker-submitted listings. The ₹1 Cr boundary is the contract:
   below it a label is lakh-denominated, at or above it crore-denominated. */
describe("price formatting", () => {
  it("formats sale prices in lakh below ₹1 crore and crore at or above it", () => {
    expect(formatPrice(4_500_000)).toBe("₹45 L");
    expect(formatPrice(9_999_999)).toBe("₹100 L");
    expect(formatPrice(10_000_000)).toBe("₹1 Cr");
    expect(formatPrice(18_500_000)).toBe("₹1.85 Cr");
    // Only an exact ".00" tail is stripped — "2.40" keeps its trailing zero,
    // which matches prevailing Indian listing style ("2.40 Cr").
    expect(formatPrice(24_000_000)).toBe("₹2.40 Cr");
  });

  it("formats rent as a rounded monthly figure", () => {
    expect(formatRent(22_000)).toBe("₹22,000 / mo");
    expect(formatRent(7_500)).toBe("₹8,000 / mo");
  });

  it("keeps every generated price label consistent with its numeric price", () => {
    for (const listing of generatedListings()) {
      if (listing.transaction === "rent") continue;
      if (listing.priceNum < 10_000_000) expect(listing.price.endsWith("L")).toBe(true);
      else expect(listing.price.endsWith("Cr")).toBe(true);
    }
  });
});
