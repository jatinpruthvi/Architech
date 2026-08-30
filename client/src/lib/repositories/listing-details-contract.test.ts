import { describe, expect, it, vi } from "vitest";
import { logger } from "../observability/logger";
import { dbListingToProperty } from "./mappers";
import {
  hasAnyListingDetail,
  listingDetailsFromSourceSummary,
  normalizeListingDetails,
} from "../listing-details-contract";

/**
 * The contract behind "why do Baths / Parking / Furnishing keep disappearing?".
 * `Listing.sourceSummary` is a prose note in the seed and in feed imports, and a
 * JSON blob in the broker draft path — one column, two meanings. These tests pin
 * the boundary that makes that survivable: never throw, never invent, and never
 * forward an unvalidated feed value into the UI.
 */
describe("normalizeListingDetails", () => {
  it("keeps values the product can also filter on", () => {
    expect(
      normalizeListingDetails({ bathrooms: 3, parkingSpaces: 2, furnishing: "SEMI_FURNISHED", facing: "EAST" }),
    ).toEqual({ bathrooms: 3, parkingSpaces: 2, furnishing: "SEMI_FURNISHED", facing: "EAST" });
  });

  it("coerces numeric strings, because feeds are text", () => {
    expect(normalizeListingDetails({ bathrooms: "4", parkingSpaces: "0" })).toEqual({ bathrooms: 4, parkingSpaces: 0 });
  });

  it("treats parking 0 as a fact but bathrooms 0 as absent", () => {
    // "No parking" is an answer a buyer needs. "0 bathrooms" is impossible.
    expect(normalizeListingDetails({ parkingSpaces: 0 })).toEqual({ parkingSpaces: 0 });
    expect(normalizeListingDetails({ bathrooms: 0 })).toEqual({});
  });

  it("drops out-of-vocabulary numbers rather than clamping them", () => {
    // BATHROOM_OPTIONS stops at 6 and PARKING_OPTIONS at 4: surfacing 7/9 would
    // require inventing filter chips the broker form never offered.
    expect(normalizeListingDetails({ bathrooms: 7, parkingSpaces: 9 })).toEqual({});
    expect(normalizeListingDetails({ bathrooms: 2.5 })).toEqual({});
    expect(normalizeListingDetails({ bathrooms: "see brochure" })).toEqual({});
  });

  it("normalises casing and separators but not unknown codes", () => {
    expect(normalizeListingDetails({ furnishing: "semi-furnished" })).toEqual({ furnishing: "SEMI_FURNISHED" });
    expect(normalizeListingDetails({ furnishing: "LUXURY" })).toEqual({});
  });

  it("refuses to render a floor above the building", () => {
    expect(normalizeListingDetails({ floorNumber: 9, totalFloors: 4 })).toEqual({ totalFloors: 4 });
    expect(normalizeListingDetails({ floorNumber: 3, totalFloors: 12 })).toEqual({ floorNumber: 3, totalFloors: 12 });
  });

  it("keeps only amenities from the shared chip vocabulary", () => {
    expect(
      normalizeListingDetails({ amenities: ["Gym", "Private submarine", "Gym", 42, null] }),
    ).toEqual({ amenities: ["Gym"] });
  });

  it("never throws on the shapes a feed can actually send", () => {
    for (const junk of [null, undefined, 42, "bathrooms: 3", [], [1, 2], true]) {
      expect(() => normalizeListingDetails(junk)).not.toThrow();
      expect(normalizeListingDetails(junk)).toEqual({});
    }
  });

  it("hasAnyListingDetail asks the parser, not Object.keys", () => {
    expect(hasAnyListingDetail({ bathrooms: "abc" })).toBe(false);
    expect(hasAnyListingDetail({ bathrooms: 2 })).toBe(true);
    expect(hasAnyListingDetail(null)).toBe(false);
  });
});

describe("listingDetailsFromSourceSummary", () => {
  it("returns nothing for prose — the normal case, and not an error", () => {
    expect(
      listingDetailsFromSourceSummary("Seeded from the August 2026 Amdavad Modern prototype fixtures."),
    ).toEqual({});
    expect(listingDetailsFromSourceSummary("")).toEqual({});
    expect(listingDetailsFromSourceSummary(null)).toEqual({});
    expect(listingDetailsFromSourceSummary(undefined)).toEqual({});
  });

  it("reads the JSON shape the broker draft writes", () => {
    const json = JSON.stringify({ bathrooms: 3, parkingSpaces: 1, amenities: ["Lift"] });
    expect(listingDetailsFromSourceSummary(json)).toEqual({ bathrooms: 3, parkingSpaces: 1, amenities: ["Lift"] });
  });

  it("reports a payload that looks structured but is not, exactly once", () => {
    const warn = vi.spyOn(logger, "warn").mockImplementation(() => {});
    expect(listingDetailsFromSourceSummary('{"bathrooms": 3')).toEqual({});
    expect(listingDetailsFromSourceSummary('{"bathrooms": 4')).toEqual({});
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it("does not treat prose that merely contains braces as JSON", () => {
    // Old behaviour: any leading `{` was parsed. A feed note like "{see photo} 3
    // baths" would previously hit JSON.parse and warn, drowning the signal.
    expect(listingDetailsFromSourceSummary("{see photo} nice flat")).toEqual({});
  });
});

describe("the mapper that lost facts", () => {
  const base = {
    stableId: "l1",
    slug: "l1",
    title: "Garden courtyard flat",
    description: "Quiet corner",
    priceLabel: "₹1.65 Cr",
    priceInr: 16500000,
    locality: { slug: "paldi", name: "Paldi" },
    city: { slug: "ahmedabad", name: "Ahmedabad" },
  };

  it("survives a feed row whose sourceSummary is prose", () => {
    const property = dbListingToProperty({ ...base, sourceSummary: "Nice society, 3 bathrooms, 2 covered parking spots." });
    expect(property.details).toEqual({});
    // The point of the guard is that this renders, not that it guesses: "3
    // bathrooms" in a sentence is not data, and inventing it here would let a
    // regex quietly become a filter facet.
    expect(property.details).not.toHaveProperty("bathrooms");
  });

  it("prefers a structured column over the prose fallback", () => {
    const property = dbListingToProperty({
      ...base,
      details: { bathrooms: 4 },
      sourceSummary: "Seeded from the August 2026 prototype fixtures.",
    });
    expect(property.details.bathrooms).toBe(4);
  });

  it("does not let an empty structured column mask the fallback", () => {
    const property = dbListingToProperty({
      ...base,
      details: {},
      sourceSummary: JSON.stringify({ bathrooms: 2 }),
    });
    expect(property.details.bathrooms).toBe(2);
  });

  it("never forwards an unvalidated feed value to the UI", () => {
    const property = dbListingToProperty({ ...base, sourceSummary: '{"bathrooms":"see brochure","amenities":null,"parkingSpaces":-3}' });
    expect(property.details).toEqual({});
  });
});
