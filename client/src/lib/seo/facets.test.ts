import { describe, expect, it } from "vitest";
import { evaluateFacetIndexability, facetIndexability, isFacetIndexable } from "./facets";

describe("faceted indexability policy (SEO-003)", () => {
  it("never marks arbitrary facet combinations as indexable in Phase 1", () => {
    expect(isFacetIndexable("3 bhk paldi", ["3bhk"], "price-asc")).toBe(false);
    expect(isFacetIndexable("", ["rera"], "fresh")).toBe(false);
    expect(evaluateFacetIndexability("", [], "fresh")).toBe("rejected");
  });

  it("reports noindex for any faceted search combination", () => {
    expect(facetIndexability("courtyard", ["2bhk", "rera"], "price-desc")).toBe("noindex");
    expect(facetIndexability("", [], "fresh")).toBe("noindex");
  });
});
