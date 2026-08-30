/* Declared query targeting.

   The claim being tested is that a listing's query can be derived from its own
   fields and checked against its title — so that "did this page achieve its
   query?" becomes answerable. The alternative, leaving the query implicit in
   the title and judging by impressions afterwards, is unfalsifiable: you
   cannot distinguish a miss from a bad month.

   The coverage check is the part most likely to be quietly wrong, so it gets
   the most tests. A check that always passes is worse than no check, because
   it gets trusted. */
import { describe, expect, it } from "vitest";
import { listingTargetQuery, serpTitleCoversQuery } from "./query-targeting";
import type { Property } from "@/lib/repositories";

function property(overrides: Partial<Property> = {}): Property {
  return {
    id: "garden-courtyard",
    title: "A garden courtyard in Paldi",
    locality: "Paldi",
    localitySlug: "paldi",
    city: "Ahmedabad",
    citySlug: "ahmedabad",
    price: "₹1.85 Cr",
    priceNum: 18_500_000,
    pricePerSqft: "₹12,480 / sq ft",
    meta: "3 BHK · Ready to move",
    bhk: 3,
    area: "1,482 sq ft",
    areaNum: 1482,
    image: "prop-courtyard",
    badge: "RERA verified",
    status: "Updated 2 days ago",
    propertyType: "APARTMENT",
    availability: "READY_TO_MOVE",
    note: "Old trees, kota stone floors.",
    transaction: "buy",
    category: "residential",
    subtype: "Flat/Apartment",
    project: "Paldi Courtyard",
    developer: "Architech Curated Homes",
    details: { bathrooms: 2 },
    ...overrides,
  } as Property;
}

describe("listingTargetQuery", () => {
  it("names the locality, the configuration, the transaction, and the entity", () => {
    expect(listingTargetQuery(property()).text).toBe(
      "3 BHK apartment for sale in Paldi, Ahmedabad — A garden courtyard in Paldi",
    );
  });

  it("reads 'rent' for a rental rather than 'sale'", () => {
    const query = listingTargetQuery(property({ transaction: "rent" }));
    expect(query.text).toContain("for rent in");
    expect(query.requiredTokens).toContain("rent");
  });

  it("carries the locality because locality carries the volume", () => {
    const query = listingTargetQuery(property());
    expect(query.locality).toBe("Paldi");
    expect(query.city).toBe("Ahmedabad");
    expect(query.requiredTokens).toContain("paldi");
  });

  it("is stable for the same listing", () => {
    expect(listingTargetQuery(property()).text).toBe(listingTargetQuery(property()).text);
  });

  it("differs between two listings in the same locality", () => {
    const a = listingTargetQuery(property());
    const b = listingTargetQuery(property({ id: "other", title: "A different house" }));
    expect(a.text).not.toBe(b.text);
  });

  it("uses the property type, not a generic word", () => {
    expect(listingTargetQuery(property({ propertyType: "VILLA" })).text).toContain("villa");
    expect(listingTargetQuery(property({ propertyType: "PLOT" })).text).toContain("plot");
  });
});

describe("serpTitleCoversQuery", () => {
  const query = listingTargetQuery(property());

  it("passes a title that carries the locality, BHK and transaction", () => {
    const coverage = serpTitleCoversQuery("3 BHK apartment for sale in Paldi", query);
    expect(coverage.answers).toBe(true);
    expect(coverage.missing).toEqual([]);
  });

  it("fails a title that drops the locality", () => {
    // The common failure: a title that fits the budget by dropping the one
    // term carrying the search volume.
    const coverage = serpTitleCoversQuery("3 BHK apartment for sale", query);
    expect(coverage.answers).toBe(false);
    expect(coverage.missing).toContain("paldi");
  });

  it("fails a title that drops the transaction", () => {
    expect(serpTitleCoversQuery("3 BHK apartment in Paldi", query).missing).toContain("sale");
  });

  it("fails a purely editorial title", () => {
    expect(serpTitleCoversQuery("A garden courtyard in Paldi", query).answers).toBe(false);
  });

  it("is case-insensitive, because SERP titles are not typed by machines", () => {
    expect(serpTitleCoversQuery("3 bhk APARTMENT FOR SALE IN PALDI", query).answers).toBe(true);
  });

  it("accounts for every required term", () => {
    const coverage = serpTitleCoversQuery("3 BHK apartment for sale in Paldi", query);
    expect(coverage.covered.length + coverage.missing.length).toBe(query.requiredTokens.length);
  });
});
