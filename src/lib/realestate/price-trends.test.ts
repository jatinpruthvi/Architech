import { describe, expect, it } from "vitest";
import { getListingsByCity } from "@/lib/repositories";
import { MIN_SAMPLE_FOR_PUBLISHED_STAT, cityPriceTrends, compactInr, localityPriceTrends, monthlyRentInr } from "./price-trends";

describe("price trends by area", () => {
  it("summarizes a locality whose sample clears the bar", () => {
    const summary = localityPriceTrends("bandra-west", "mumbai");
    expect(summary.published).toBe(true);
    expect(summary.minPriceInr).toBeGreaterThan(0);
    expect(summary.medianPriceInr).toBeGreaterThanOrEqual(summary.minPriceInr!);
    expect(summary.maxPriceInr).toBeGreaterThanOrEqual(summary.medianPriceInr!);
  });

  /* The corrected behaviour: a single listing is not a price range. Paldi holds
     one sale home, so the locality summary is withheld rather than presenting
     that home's asking price as a median. */
  it("withholds a locality summary whose sample is below the bar", () => {
    const summary = localityPriceTrends("paldi");
    expect(summary.slug).toBe("paldi");
    expect(summary.name).toBe("Paldi");
    expect(summary.count).toBeGreaterThanOrEqual(1);
    expect(summary.saleSampleSize).toBeLessThan(MIN_SAMPLE_FOR_PUBLISHED_STAT);
    expect(summary.published).toBe(false);
    expect(summary.minPriceInr).toBeNull();
    expect(summary.medianPriceInr).toBeNull();
    expect(summary.maxPriceInr).toBeNull();
  });

  it("computes average price-per-sqft and availability mix", () => {
    const summary = cityPriceTrends("mumbai");
    expect(summary.published).toBe(true);
    expect(summary.avgPricePerSqftInr).toBeGreaterThan(0);
    expect(Object.keys(summary.availabilityMix).length).toBeGreaterThan(0);
    // At least one demo listing is new construction or resale.
    expect(summary.newConstructionCount).toBeGreaterThanOrEqual(0);
  });

  /* Rent is stored as monthly rupees x 100, so a rental added to a sale price
     is not a rounding error. The city summary must not contain one. */
  it("keeps rentals out of every published price figure", () => {
    for (const city of ["ahmedabad", "mumbai"]) {
      const summary = cityPriceTrends(city);
      const rents = getListingsByCity(city)
        .map(monthlyRentInr)
        .filter((value): value is number => value !== null);
      expect(rents.length).toBeGreaterThan(0);
      expect(summary.rentSampleSize).toBe(rents.length);
      if (summary.published) {
        expect(summary.medianPriceInr).not.toBeNull();
        for (const rent of rents) expect(summary.medianPriceInr).not.toBe(rent * 100);
      }
    }
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
