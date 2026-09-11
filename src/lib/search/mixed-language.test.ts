import { describe, expect, it } from "vitest";
import { localityMatchesToken, normalizeLocalityToken, resolveLocalitiesFromQuery } from "./aliases";
import { parseSearchQuery } from "./parse-query";
import { applyQuery } from "@/lib/filters";
import { getListings } from "@/lib/repositories";

/* Mixed-language search golden queries (P1-SEARCH-001 / P1-I18N-001 remaining).

   The deterministic grammar must understand the same query whether it is typed
   in English, Devanagari, or a mix — and a locality alias in any script must
   resolve to the same slug. These are fixture-backed golden queries: the
   database-backed half of the tracker is provisioning-gated, but the
   fixture-backed behavior is fully testable here and must not regress. */

describe("mixed-language golden queries", () => {
  it.each([
    ["पालडी", "paldi"],
    ["paldi", "paldi"],
    ["बोपल", "bopal"],
    ["bopal", "bopal"],
    ["प्रहलाद नगर", "prahlad-nagar"],
    ["prahlad nagar", "prahlad-nagar"],
  ] as const)("resolves %s to the %s locality", (query, slug) => {
    expect(resolveLocalitiesFromQuery(query)).toContain(slug);
  });

  it("understands a Devanagari locality inside a structured query", () => {
    const parsed = parseSearchQuery("3 bhk पालडी");
    expect(parsed.bhk).toBe(3);
    expect(parsed.localities.map((locality) => locality.slug)).toEqual(["paldi"]);
    expect(parsed.city?.slug).toBe("ahmedabad");
  });

  it("understands a Devanagari city name", () => {
    const parsed = parseSearchQuery("अमदावाद में घर");
    expect(parsed.city?.slug).toBe("ahmedabad");
    /* "में" is the Hindi "in" and "घर" is the Hindi "home": both must be
       consumed, never leaked as free-text residual that would AND-match
       against nothing and empty the result set. */
    expect(parsed.residual).toBe("");
  });

  it("understands Hindi intent words", () => {
    expect(parseSearchQuery("किराया पालडी").intent).toBe("rent");
    expect(parseSearchQuery("खरीद अमदावाद").intent).toBe("buy");
    expect(parseSearchQuery("खरीद अमदावाद").city?.slug).toBe("ahmedabad");
  });

  it("matches a concatenated locality alias like prahladnagar", () => {
    /* A search box receives "prahladnagar" (no space) far more often than the
       two-word form. The English name's space-stripped form must be an alias. */
    expect(localityMatchesToken("prahlad-nagar", "prahladnagar")).toBe(true);
    expect(resolveLocalitiesFromQuery("prahladnagar")).toContain("prahlad-nagar");
  });

  it("filters inventory by a concatenated mixed-language alias", () => {
    const matches = applyQuery(getListings(), "prahladnagar");
    expect(matches.length).toBeGreaterThan(0);
    expect(matches.every((listing) => listing.localitySlug === "prahlad-nagar")).toBe(true);
  });

  it("normalizes Devanagari to a stable Latin form", () => {
    expect(normalizeLocalityToken("पालडी")).toMatch(/^[a-z ]+$/);
    expect(normalizeLocalityToken("पालडी")).toBe(normalizeLocalityToken("पालडी"));
  });
});
