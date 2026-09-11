import { describe, expect, it } from "vitest";
import { TRANSFER_CHARGES, calculateOwnershipCost, compactInr, monthlyEmi, transferChargesFor, validateOwnershipAssumptions } from "./ownership";

describe("ownership cost estimator", () => {
  it("computes a sensible monthly EMI for a standard loan", () => {
    const emi = monthlyEmi(12_000_000, 20, 8.5);
    expect(emi).toBeGreaterThan(100_000);
    expect(emi).toBeLessThan(130_000);
  });

  it("derives default 80/20 financing and explicitly scoped Gujarat costs", () => {
    const cost = calculateOwnershipCost({ priceInr: 15_000_000, state: "Gujarat" });
    expect(cost.loanInr).toBe(12_000_000);
    expect(cost.downPaymentInr).toBe(3_000_000);
    expect(cost.stampDutyInr).toBe(750_000);
    expect(cost.registrationInr).toBe(150_000);
    expect(cost.oneTimeCostsInr).toBe(900_000);
    expect(cost.cashRequiredInr).toBe(3_900_000);
    expect(cost.charges?.state).toBe("Gujarat");
    expect(cost.charges?.sourceUrl).toContain("gujarat.gov.in");
    expect(cost.statutoryStatus).toBe("available");
  });

  it("never applies Gujarat rates to an unknown or missing state", () => {
    for (const state of ["Karnataka", "Maharashtra", undefined]) {
      const cost = calculateOwnershipCost({ priceInr: 15_000_000, state });
      expect(cost.charges).toBeNull();
      expect(cost.stampDutyInr).toBeNull();
      expect(cost.registrationInr).toBeNull();
      expect(cost.oneTimeCostsInr).toBeNull();
      expect(cost.cashRequiredInr).toBeNull();
      expect(cost.statutoryStatus).toBe("unavailable");
      expect(cost.monthlyEmiInr).toBeGreaterThan(0);
    }
  });

  it("uses paired reader overrides while labelling them as unverified", () => {
    const cost = calculateOwnershipCost({
      priceInr: 20_000_000,
      state: "Karnataka",
      stampDutyRate: 0.06,
      registrationRate: 0.01,
    });
    expect(cost.stampDutyInr).toBe(1_200_000);
    expect(cost.registrationInr).toBe(200_000);
    expect(cost.charges?.basis).toBe("user-assumption");
    expect(cost.charges?.sourceUrl).toBeNull();
  });

  it("rejects a partial statutory override", () => {
    expect(validateOwnershipAssumptions({ priceInr: 10_000_000, stampDutyRate: 0.05 })).toContain(
      "Supply both stamp duty and registration rates together.",
    );
  });

  it("respects explicit zero loan, tenor, and interest rate", () => {
    const cost = calculateOwnershipCost({ priceInr: 20_000_000, loanInr: 0, tenorYears: 15, annualRatePct: 0 });
    expect(cost.loanInr).toBe(0);
    expect(cost.downPaymentInr).toBe(20_000_000);
    expect(cost.tenorYears).toBe(15);
    expect(cost.annualRatePct).toBe(0);
    expect(cost.monthlyEmiInr).toBe(0);
  });

  it("records only explicit state rules", () => {
    expect(transferChargesFor("Gujarat")?.stampDutyRate).toBe(0.05);
    expect(transferChargesFor(" gujarat ")).toBe(TRANSFER_CHARGES[0]);
    expect(transferChargesFor("Karnataka")).toBeNull();
    expect(transferChargesFor(undefined)).toBeNull();
  });

  it("formats INR compactly", () => {
    expect(compactInr(15_000_000)).toBe("₹1.50 Cr");
    expect(compactInr(900_000)).toBe("₹9.0 L");
    expect(compactInr(45_000)).toBe("₹45,000");
  });
});
