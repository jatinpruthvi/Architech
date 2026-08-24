import { describe, expect, it } from "vitest";
import { GET } from "../../../../app/api/search/route";
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

  it("parses URLSearchParams the same way as the API route", () => {
    const response = searchListingsFromSearchParams(new URLSearchParams("q=Thaltej&filters=3bhk,rera&sort=price-asc"));
    expect(response.results.map((property) => property.id)).toEqual(["thaltej-dusk-house"]);
  });

  it("returns JSON from the route handler", async () => {
    const response = await GET(new Request("http://example.com/api/search?q=Paldi&filters=rera"));
    expect(response.headers.get("X-Architech-Search-Source")).toBe("fixture-repository");
    const body = await response.json();
    expect(body.results.map((property: { id: string }) => property.id)).toContain("garden-courtyard");
  });
});
