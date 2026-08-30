import { describe, expect, it } from "vitest";
import { DEFAULT_TRANSFER_CHARGES, TRANSFER_CHARGES, calculateOwnershipCost, compactInr, monthlyEmi, transferChargesFor } from "./ownership";

describe("ownership cost estimator", () => {
  it("computes a sensible monthly EMI for a standard loan", () => {
    // 1.5 Cr home, 80% LTV, 20y @ 8.5%
    const emi = monthlyEmi(12_000_000, 20, 8.5);
    expect(emi).toBeGreaterThan(100_000);
    expect(emi).toBeLessThan(130_000);
  });

  it("derives default LTV (80/20) and one-time costs", () => {
    const cost = calculateOwnershipCost({ priceInr: 15_000_000 });
    expect(cost.loanInr).toBe(12_000_000); // 80%
    expect(cost.downPaymentInr).toBe(3_000_000); // 20%
    expect(cost.stampDutyInr).toBe(750_000); // 5%
    expect(cost.registrationInr).toBe(150_000); // 1%
    expect(cost.oneTimeCostsInr).toBe(900_000);
    expect(cost.cashRequiredInr).toBe(3_900_000);
    expect(cost.monthlyEmiInr).toBeGreaterThan(0);
  });

  it("respects explicit loan, tenor, and rates", () => {
    const cost = calculateOwnershipCost({ priceInr: 20_000_000, loanInr: 16_000_000, tenorYears: 15, annualRatePct: 9 });
    expect(cost.loanInr).toBe(16_000_000);
    expect(cost.tenorYears).toBe(15);
    expect(cost.annualRatePct).toBe(9);
  });

  it("returns zero totals for a zero price", () => {
    const cost = calculateOwnershipCost({ priceInr: 0 });
    expect(cost.monthlyEmiInr).toBe(0);
    expect(cost.cashRequiredInr).toBe(0);
  });

  /* The rates were previously written twice — once here and once as a `RATES`
     literal in `app/api/cost/ownership/route.ts`. Two copies of a state rate
     can drift, and the API could quote a buyer a different stamp duty than the
     page shows for the same house. There is now one registry. */
  it("resolves stamp duty and registration from the single rate registry", () => {
    const cost = calculateOwnershipCost({ priceInr: 15_000_000, state: "Gujarat" });
    expect(cost.charges.state).toBe("Gujarat");
    expect(cost.stampDutyInr).toBe(750_000);
    expect(cost.registrationInr).toBe(150_000);

    // The registry is the source the defaults come from, not a parallel copy.
    expect(DEFAULT_TRANSFER_CHARGES).toBe(TRANSFER_CHARGES[0]);
    expect(calculateOwnershipCost({ priceInr: 15_000_000 }).stampDutyInr).toBe(750_000);
  });

  it("records the state a rate belongs to, and says when it does not know one", () => {
    expect(transferChargesFor("Gujarat")?.stampDutyRate).toBe(0.05);
    // An unrecorded state returns null rather than a plausible guess: stamp
    // duty is set per state and a wrong figure is quoted to a buyer.
    expect(transferChargesFor("Karnataka")).toBeNull();
    expect(transferChargesFor(undefined)).toBeNull();
  });

  it("carries the scope note with the figures so it cannot be shown bare", () => {
    const cost = calculateOwnershipCost({ priceInr: 15_000_000, state: "Karnataka" });
    // Falls back to the registry default, and the result still names which
    // state's rate it used.
    expect(cost.charges.state).toBe(DEFAULT_TRANSFER_CHARGES.state);
    expect(cost.charges.note.length).toBeGreaterThan(0);
  });

  it("formats INR compactly", () => {
    expect(compactInr(15_000_000)).toBe("₹1.50 Cr");
    expect(compactInr(900_000)).toBe("₹9.0 L");
    expect(compactInr(45_000)).toBe("₹45,000");
  });
});
