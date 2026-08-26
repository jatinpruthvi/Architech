import { describe, expect, it } from "vitest";
import { formatPsf, localityIntel } from "./locality-intel";

describe("locality intelligence", () => {
  it("produces provenance-labeled buy facts for a locality with inventory", () => {
    const intel = localityIntel("paldi");
    expect(intel.slug).toBe("paldi");
    expect(intel.name).toBe("Paldi");
    expect(intel.buyCount).toBeGreaterThanOrEqual(1);
    expect(intel.minPriceInr).toBeGreaterThan(0);
    if (intel.minPriceInr && intel.medianPriceInr) {
      expect(intel.medianPriceInr).toBeGreaterThanOrEqual(intel.minPriceInr);
    }
    if (intel.medianPriceInr && intel.maxPriceInr) {
      expect(intel.maxPriceInr).toBeGreaterThanOrEqual(intel.medianPriceInr);
    }
    // An as-of label is always present so readers can assess freshness.
    expect(intel.asOfLabel).toMatch(/\d{1,2} [A-Za-z]{3} \d{4}/);
    // Position is only reported against a real city baseline.
    expect(typeof intel.position.deltaPct).toBe("number");
  });

  it("never reports rent listings as buy price facts", () => {
    // Bopal's fixture is a rental; buy stats stay honest (empty) rather than
    // mixing a monthly rent into crore-scale buy prices.
    const intel = localityIntel("bopal");
    expect(intel.buyCount).toBe(0);
    expect(intel.minPriceInr).toBeNull();
    expect(intel.medianPriceInr).toBeNull();
    expect(intel.byBhk).toEqual([]);
    expect(intel.byBudget).toEqual([]);
    // Rent inventory is reported separately.
    expect(intel.rentCount).toBeGreaterThanOrEqual(1);
  });

  it("groups inventory by configuration and budget only where present", () => {
    const intel = localityIntel("paldi");
    const totalFromBhk = intel.byBhk.reduce((sum, b) => sum + b.count, 0);
    expect(totalFromBhk).toBe(intel.buyCount);
    const totalFromBudget = intel.byBudget.reduce((sum, b) => sum + b.count, 0);
    expect(totalFromBudget).toBe(intel.buyCount);
    expect(intel.byBhk.every((b) => b.count >= 1)).toBe(true);
  });

  it("derives commute stops from the locality's measured landmarks", () => {
    const intel = localityIntel("paldi");
    expect(intel.commute.length).toBeGreaterThanOrEqual(1);
    expect(intel.commute[0]).toHaveProperty("place");
    expect(intel.commute[0]).toHaveProperty("distance");
    expect(intel.commute[0]).toHaveProperty("category");
  });

  it("returns an honest empty summary for an unknown locality", () => {
    const intel = localityIntel("does-not-exist");
    expect(intel.buyCount).toBe(0);
    expect(intel.medianPriceInr).toBeNull();
    expect(intel.position.deltaPct).toBeNull();
    expect(intel.commute).toEqual([]);
  });

  it("formats per-sqft labels", () => {
    expect(formatPsf(11_350)).toBe("₹11,350");
    expect(formatPsf(null)).toBe("—");
  });
});
