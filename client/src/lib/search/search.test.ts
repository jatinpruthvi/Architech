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
    expect(searchListings({ filters: ["type-villa"] }).results.map((property) => property.id)).toEqual(["thaltej-dusk-house"]);
    expect(searchListings({ filters: ["availability-new"] }).results.map((property) => property.id)).toEqual(["light-filled-home"]);
  });
});
