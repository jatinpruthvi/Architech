import { describe, expect, it } from "vitest";
import { decodeDigipin, decodeDigipinBounds, encodeDigipin, isValidDigipin } from "./digipin";

describe("DIGIPIN reference implementation", () => {
  it("matches the India Post reference vector", () => {
    expect(encodeDigipin(13.11179621, 80.20264269)).toBe("4T396F42L7");
  });

  it("round-trips a coordinate into its decoded cell", () => {
    const latitude = 28.6139;
    const longitude = 77.209;
    const code = encodeDigipin(latitude, longitude);
    const bounds = decodeDigipinBounds(code);
    expect(isValidDigipin(code)).toBe(true);
    expect(latitude).toBeGreaterThanOrEqual(bounds.minLatitude);
    expect(latitude).toBeLessThanOrEqual(bounds.maxLatitude);
    expect(longitude).toBeGreaterThanOrEqual(bounds.minLongitude);
    expect(longitude).toBeLessThanOrEqual(bounds.maxLongitude);
    const center = decodeDigipin(code);
    expect(center.latitude).toBeGreaterThanOrEqual(bounds.minLatitude);
    expect(center.longitude).toBeLessThanOrEqual(bounds.maxLongitude);
  });

  it("normalizes case for validation and decoding, but rejects separators", () => {
    expect(isValidDigipin("4t396f42l7")).toBe(true);
    expect(decodeDigipin("4t396f42l7")).toEqual(decodeDigipin("4T396F42L7"));
    expect(isValidDigipin("4T3-96F42L7")).toBe(false);
  });

  it("rejects coordinates outside the India Post grid", () => {
    expect(() => encodeDigipin(0, 77)).toThrow(RangeError);
    expect(() => encodeDigipin(20, 120)).toThrow(RangeError);
  });
});
