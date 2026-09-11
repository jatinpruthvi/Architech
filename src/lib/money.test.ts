import { describe, expect, it } from "vitest";
import { MAX_SAFE_INR, MoneyPrecisionError, inrToBigInt, inrToDecimalString, inrToNumber } from "./money";

describe("INR money boundary", () => {
  it("narrows a database BigInt to a domain number", () => {
    expect(inrToNumber(BigInt(16500000))).toBe(16500000);
  });

  it("passes through a number unchanged so mixed-source rows are safe", () => {
    expect(inrToNumber(18500000)).toBe(18500000);
  });

  it("treats null and undefined as zero rather than NaN", () => {
    expect(inrToNumber(null)).toBe(0);
    expect(inrToNumber(undefined)).toBe(0);
  });

  it("carries a value above the old Int32 ceiling without loss", () => {
    // ₹500 crore: rejected by the previous Int column, exact here.
    const fiveHundredCrore = BigInt("5000000000");
    expect(inrToNumber(fiveHundredCrore)).toBe(5000000000);
  });

  it("throws rather than silently corrupting above 2^53", () => {
    expect(() => inrToNumber(MAX_SAFE_INR + BigInt(1), "priceInr")).toThrow(MoneyPrecisionError);
  });

  it("widens a whole-rupee number to BigInt", () => {
    expect(inrToBigInt(16500000)).toBe(BigInt(16500000));
  });

  it("rejects a fractional amount instead of rounding on the caller's behalf", () => {
    expect(() => inrToBigInt(1500.75, "priceInr")).toThrow(/whole rupee/);
  });

  it("rejects non-finite input", () => {
    expect(() => inrToBigInt(Number.NaN)).toThrow(MoneyPrecisionError);
  });

  it("serialises to the decimal string ERPNext's decimal(21,9) expects", () => {
    expect(inrToDecimalString(BigInt(500000))).toBe("500000.000000000");
    expect(inrToDecimalString(16500000)).toBe("16500000.000000000");
  });

  it("keeps large amounts exact through the wire format", () => {
    // JSON.stringify cannot serialise a BigInt at all; the string form is why.
    expect(inrToDecimalString(BigInt("5000000000"))).toBe("5000000000.000000000");
  });
});
