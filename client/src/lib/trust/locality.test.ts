import { describe, expect, it } from "vitest";
import { cityTrustSummary, localityTrustSummary } from "./locality";

describe("locality/city trust aggregation", () => {
  it("aggregates city-wide trust from per-listing scores", () => {
    const summary = cityTrustSummary();
    expect(summary.slug).toBe("ahmedabad");
    expect(summary.name).toBe("Ahmedabad");
    expect(summary.total).toBeGreaterThanOrEqual(4);
    expect(summary.reraVerified).toBeGreaterThanOrEqual(2);
    expect(summary.sourceReviewed).toBeGreaterThanOrEqual(4);
    expect(summary.avgScore).toBeGreaterThanOrEqual(0);
    expect(summary.avgScore).toBeLessThanOrEqual(100);
    // RERA coverage is derived from verified listings; for the fixture it is > 0.
    expect(summary.reraCoveragePct).toBeGreaterThan(0);
  });

  it("reports full RERA coverage for a locality with a RERA-verified home", () => {
    const summary = localityTrustSummary("paldi");
    expect(summary.total).toBeGreaterThanOrEqual(1);
    expect(summary.reraCoveragePct).toBe(100);
    expect(summary.grade).toBe("HIGH");
  });

  it("treats a locality with source-reviewed inventory as moderate trust", () => {
    const summary = localityTrustSummary("navrangpura");
    expect(summary.reraCoveragePct).toBe(0);
    expect(summary.grade).toBe("MEDIUM");
  });

  it("handles an empty locality without throwing", () => {
    const summary = localityTrustSummary("does-not-exist");
    expect(summary.total).toBe(0);
    expect(summary.avgScore).toBe(0);
    expect(summary.reraCoveragePct).toBe(0);
  });
});
