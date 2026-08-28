import { describe, expect, it } from "vitest";
import { normalizeLimit, normalizeSort, searchListings, searchListingsFromSearchParams } from "./search";

describe("backend search contract", () => {
  it("normalizes sort and limit inputs", () => {
    expect(normalizeSort("price-asc")).toBe("price-asc");
    expect(normalizeSort("unknown")).toBe("fresh");
    expect(normalizeLimit("3")).toBe(3);
    expect(normalizeLimit("999")).toBe(100);
    expect(normalizeLimit("nope")).toBeUndefined();
  });

  it("applies deterministic query, filters, sort, and limit", () => {
    const response = searchListings({ q: "2 BHK", filters: ["under15"], sort: "price-desc", limit: 1 });
    expect(response.source).toBe("fixture-repository");
    expect(response.count).toBeGreaterThanOrEqual(1);
    expect(response.results).toHaveLength(1);
    expect(response.results[0].bhk).toBe(2);
    expect(response.results[0].priceNum).toBeLessThan(15_000_000);
  });

  it("parses URLSearchParams consistently with the API contract", () => {
    const response = searchListingsFromSearchParams(new URLSearchParams("q=Thaltej&filters=3bhk,rera&sort=price-asc"));
    expect(response.results.map((property) => property.id)).toEqual(["thaltej-dusk-house"]);
  });

  it("matches a Devanagari locality query via alias resolution", () => {
    const response = searchListings({ q: "पालडी" });
    expect(response.results.some((property) => property.localitySlug === "paldi")).toBe(true);
  });

  it("matches a transliterated locality alias variant", () => {
    const response = searchListings({ q: "prahlad nagar" });
    expect(response.results.some((property) => property.localitySlug === "prahlad-nagar")).toBe(true);
  });

  it("applies reviewed property type and availability facets", () => {
    // Facets are asserted within one city scope; nationwide search spans every market.
    expect(searchListings({ city: "ahmedabad", filters: ["type-villa"] }).results.map((property) => property.id)).toEqual(["thaltej-dusk-house"]);
    expect(searchListings({ city: "ahmedabad", filters: ["availability-new"] }).results.map((property) => property.id)).toEqual(["light-filled-home"]);
  });

  it("narrows results to a PIN and echoes the scope", () => {
    const response = searchListings({ pincode: "395007" });
    expect(response.pincode).toBe("395007");
    expect(response.results.length).toBeGreaterThan(0);
    // 395007 covers both Vesu and Piplod, so both localities stay in scope.
    const slugs = new Set(response.results.map((property) => property.localitySlug));
    expect([...slugs].sort()).toEqual(["piplod", "vesu"]);
  });

  it("combines a PIN with a city scope and reports no PIN when none is given", () => {
    expect(searchListings({ city: "surat", pincode: "395007" }).results.length).toBeGreaterThan(0);
    // A PIN outside the chosen city can legitimately return nothing.
    expect(searchListings({ city: "pune", pincode: "395007" }).results).toEqual([]);
    expect(searchListings({}).pincode).toBeNull();
  });

  it("ignores a malformed PIN instead of emptying the page", () => {
    const response = searchListings({ pincode: "not-a-pin" });
    expect(response.pincode).toBeNull();
    expect(response.count).toBe(searchListings({}).count);
  });

  it("treats a bare six-digit token in the query as a PIN", () => {
    const response = searchListings({ q: "411057" });
    expect(response.results.length).toBeGreaterThan(0);
    const slugs = new Set(response.results.map((property) => property.localitySlug));
    expect([...slugs].sort()).toEqual(["hinjawadi", "wakad"]);
  });

  it("combines a PIN token with other query tokens", () => {
    const response = searchListings({ q: "3 bhk 411057" });
    expect(response.results.every((property) => property.bhk === 3)).toBe(true);
    expect(response.results.every((property) => ["hinjawadi", "wakad"].includes(property.localitySlug))).toBe(true);
  });

  it("reads ?pincode= from URL params", () => {
    const response = searchListingsFromSearchParams(new URLSearchParams("pincode=560066"));
    expect(response.pincode).toBe("560066");
    expect(response.results.every((property) => property.localitySlug === "whitefield")).toBe(true);
  });

  it("carries intent and category through URL params (home buy/rent toggle)", () => {
    // Rent intent is honoured and now returns the added rent fixtures.
    const rent = searchListings({ intent: "rent" });
    expect(rent.results.length).toBeGreaterThan(0);
    expect(rent.results.every((p) => p.transaction === "rent")).toBe(true);
    expect(searchListingsFromSearchParams(new URLSearchParams("intent=rent")).intent).toBe("rent");
    expect(searchListingsFromSearchParams(new URLSearchParams("intent=buy")).intent).toBe("buy");

    const withCat = searchListingsFromSearchParams(new URLSearchParams("intent=buy&category=residential"));
    expect(withCat.category).toBe("residential");
    expect(withCat.results.length).toBeGreaterThan(0);
  });
});
