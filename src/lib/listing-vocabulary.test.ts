import { describe, expect, it } from "vitest";
import { isAvailabilityCode, isPropertyTypeCode, normalizeAvailability } from "./listing-vocabulary";

describe("reviewed listing vocabulary", () => {
  it("accepts only the approved property type codes", () => {
    expect(isPropertyTypeCode("APARTMENT")).toBe(true);
    expect(isPropertyTypeCode("COMMERCIAL")).toBe(false);
    expect(isPropertyTypeCode("Flat/Apartment")).toBe(false);
  });

  it("normalizes legacy availability labels to stable codes", () => {
    expect(normalizeAvailability("Ready to move")).toBe("READY_TO_MOVE");
    expect(normalizeAvailability("NEW_LAUNCH")).toBe("NEW_LAUNCH");
    expect(normalizeAvailability("unknown label")).toBeUndefined();
  });

  it("recognizes only approved availability codes", () => {
    expect(isAvailabilityCode("RESALE")).toBe(true);
    expect(isAvailabilityCode("available")).toBe(false);
  });
});
