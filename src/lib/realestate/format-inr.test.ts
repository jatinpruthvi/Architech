import { describe, expect, it } from "vitest";
import { compactInr, formatPsf } from "./format-inr";

/* First tests for this module. It is pure, imported by client components, and
   formats money shown to users — a wrong boundary here misprices a listing on
   the page. Boundaries are pinned explicitly because the two thresholds
   (1e5 lakh, 1e7 crore) are easy to shift by a factor of ten. */

describe("compactInr", () => {
  it("renders an em dash for a missing value", () => {
    expect(compactInr(null)).toBe("—");
  });

  it("uses Indian digit grouping below one lakh", () => {
    expect(compactInr(0)).toBe("₹0");
    expect(compactInr(999)).toBe("₹999");
    expect(compactInr(99_999)).toBe("₹99,999");
  });

  it("switches to lakh at exactly 1,00,000", () => {
    expect(compactInr(100_000)).toBe("₹1.0 L");
    expect(compactInr(150_000)).toBe("₹1.5 L");
    expect(compactInr(9_900_000)).toBe("₹99.0 L");
  });

  it("switches to crore at exactly 1,00,00,000", () => {
    expect(compactInr(10_000_000)).toBe("₹1.00 Cr");
    expect(compactInr(25_000_000)).toBe("₹2.50 Cr");
    expect(compactInr(125_000_000)).toBe("₹12.50 Cr");
  });

  it("keeps two decimals for crore and one for lakh", () => {
    expect(compactInr(12_345_678)).toBe("₹1.23 Cr");
    expect(compactInr(1_234_567)).toBe("₹12.3 L");
  });

  it("does not claim a unit for a negative value", () => {
    // Not a real price; pinned so a refactor cannot turn it into "-1.0 L".
    expect(compactInr(-1)).toBe("₹-1");
  });
});

describe("formatPsf", () => {
  it("renders an em dash for a missing value", () => {
    expect(formatPsf(null)).toBe("—");
  });

  it("rounds to whole rupees with Indian grouping", () => {
    expect(formatPsf(4_321.4)).toBe("₹4,321");
    expect(formatPsf(4_321.6)).toBe("₹4,322");
    expect(formatPsf(125_000)).toBe("₹1,25,000");
  });

  it("handles zero", () => {
    expect(formatPsf(0)).toBe("₹0");
  });
});
