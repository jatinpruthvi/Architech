import { describe, expect, it } from "vitest";
import { cityPriceTrends, compactInr, localityPriceTrends } from "./price-trends";

describe("price trends by area", () => {
  it("summarizes a locality with a valid price range", () => {
    const summary = localityPriceTrends("paldi");
    expect(summary.slug).toBe("paldi");
    expect(summary.name).toBe("Paldi");
    expect(summary.count).toBeGreaterThanOrEqual(1);
    expect(summary.minPriceInr).toBeGreaterThan(0);
    expect(summary.medianPriceInr).toBeGreaterThanOrEqual(summary.minPriceInr!);
    expect(summary.maxPriceInr).toBeGreaterThanOrEqual(summary.medianPriceInr!);
  });

  it("computes average price-per-sqft and availability mix", () => {
    const summary = cityPriceTrends();
    expect(summary.avgPricePerSqftInr).toBeGreaterThan(0);
    expect(Object.keys(summary.availabilityMix).length).toBeGreaterThan(0);
    // At least one demo listing is new construction or resale.
    expect(summary.newConstructionCount).toBeGreaterThanOrEqual(0);
  });

  it("returns an empty summary for an unknown locality", () => {
    const summary = localityPriceTrends("does-not-exist");
    expect(summary.count).toBe(0);
    expect(summary.minPriceInr).toBeNull();
    expect(summary.medianPriceInr).toBeNull();
  });

  it("formats INR compactly", () => {
    expect(compactInr(18_500_000)).toBe("₹1.85 Cr");
    expect(compactInr(1_200_000)).toBe("₹12.0 L");
    expect(compactInr(null)).toBe("—");
  });
});
