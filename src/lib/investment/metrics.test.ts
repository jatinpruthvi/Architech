import { describe, expect, it } from "vitest";
import { annualRentFromMonthly, calculateInvestmentMetrics } from "./metrics";

const defaults = {
  priceInr: 60_000_000,
  annualRentInr: 3_600_000,
  annualExpensesInr: 400_000,
  downPaymentInr: 15_000_000,
};

describe("investment analysis metrics", () => {
  it("computes gross yield and GRM", () => {
    const metrics = calculateInvestmentMetrics(defaults);
    expect(metrics.grossYieldPct).toBe(6); // 3.6M / 60M = 6%
    expect(metrics.grm).toBeCloseTo(16.67, 1); // 60M / 3.6M ≈ 16.67
  });

  it("computes NOI, cap rate, and cash-on-cash", () => {
    const metrics = calculateInvestmentMetrics(defaults);
    expect(metrics.noiInr).toBe(3_200_000); // 3.6M - 400k
    expect(metrics.capRatePct).toBeCloseTo(5.33, 1); // 3.2M / 60M
    expect(metrics.cashOnCashPct).toBeCloseTo(21.33, 1); // 3.2M / 15M (no debt service modelled)
    expect(metrics.cashOnCashApproximation).toBe(true);
  });

  it("returns null yields when there is no rent or price", () => {
    const metrics = calculateInvestmentMetrics({ priceInr: 0, annualRentInr: 0, annualExpensesInr: 0, downPaymentInr: 0 });
    expect(metrics.grossYieldPct).toBeNull();
    expect(metrics.grm).toBeNull();
    expect(metrics.capRatePct).toBeNull();
  });

  it("derives annual rent from monthly", () => {
    expect(annualRentFromMonthly(300_000)).toBe(3_600_000);
    expect(annualRentFromMonthly(300_000, 11)).toBe(3_300_000);
  });
});
