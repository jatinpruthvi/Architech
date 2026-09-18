import { describe, expect, it } from "vitest";
import { preferredInventoryView } from "./view-preference";

describe("preferredInventoryView", () => {
  it("defaults a first-time mobile broker to scannable cards", () => {
    expect(preferredInventoryView(null, true)).toBe("cards");
  });

  it("defaults a first-time desktop broker to the dense table", () => {
    expect(preferredInventoryView(null, false)).toBe("table");
  });

  it("keeps the broker's explicit choice across viewport changes", () => {
    expect(preferredInventoryView("table", true)).toBe("table");
    expect(preferredInventoryView("cards", false)).toBe("cards");
  });

  it("ignores an invalid stored value", () => {
    expect(preferredInventoryView("unknown", true)).toBe("cards");
  });
});
