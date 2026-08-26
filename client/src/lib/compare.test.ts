import { describe, expect, it } from "vitest";
import { getListings } from "@/lib/repositories";
import { COMPARE_ROWS, normalizeCompareIds, selectComparableListings } from "./compare";

describe("compare experience", () => {
  it("normalizes comma-separated and repeated input while capping at four homes", () => {
    expect(normalizeCompareIds(" garden-courtyard, light-filled-home ,garden-courtyard ")).toEqual(["garden-courtyard", "light-filled-home", "garden-courtyard"]);
    expect(normalizeCompareIds(["garden-courtyard,light-filled-home", "thaltej-dusk-house"])).toEqual(["garden-courtyard", "light-filled-home", "thaltej-dusk-house"]);
    expect(normalizeCompareIds(["a,b,c,d,e"])).toHaveLength(4);
  });

  it("selects only known listings and keeps the canonical listing order", () => {
    const listings = getListings();
    const selected = selectComparableListings(listings, "light-filled-home,garden-courtyard,missing-id");
    expect(selected.map((listing) => listing.id)).toEqual(["garden-courtyard", "light-filled-home"]);
  });

  it("exposes every decision row rendered by the compare dossier", () => {
    expect(COMPARE_ROWS.map((row) => row.label)).toEqual(["Price", "Rate", "Layout", "Carpet area", "Locality", "Verification", "Availability", "Evidence"]);
    const [first] = getListings();
    expect(COMPARE_ROWS.every((row) => row.get(first).trim().length > 0)).toBe(true);
  });
});
