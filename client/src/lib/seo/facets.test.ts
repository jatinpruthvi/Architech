import { describe, expect, it } from "vitest";
import { evaluateFacetGate, evaluateFacetIndexability, facetCanonicalUrl, facetIndexability, facetRobots, isFacetIndexable, FACET_POLICY } from "./facets";

/* Contestant B §1: "Index a facet only if it has ≥5 live listings AND real
   search volume. Everything else → noindex, follow."

   The gate must be genuinely evaluable — not a stub that returns false — while
   staying shut until there is real demand evidence behind a combination. */

const qualified = {
  listingCount: 12,
  hasUniqueContent: true,
  hasDocumentedDemand: true,
  hasStableUrl: true,
  hasParentLink: true,
};

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

  it("qualifies a facet that clears every bar", () => {
    const decision = evaluateFacetGate(qualified);
    expect(decision.gate).toBe("qualified");
    expect(decision.indexable).toBe(true);
    expect(decision.reasons).toEqual([]);
  });

  it("rejects a facet below the live-listing threshold", () => {
    // The specific bar from the recommendation: >= 5 live listings.
    const decision = evaluateFacetGate({ ...qualified, listingCount: FACET_POLICY.minListings - 1 });
    expect(decision.gate).toBe("rejected");
    expect(decision.reasons.some((reason) => reason.includes("live listings"))).toBe(true);
    // Exactly at the threshold passes.
    expect(evaluateFacetGate({ ...qualified, listingCount: FACET_POLICY.minListings }).gate).toBe("qualified");
  });

  it("still rejects a well-stocked facet with no evidenced demand", () => {
    // This is the whole point of the gate: inventory alone is not permission.
    // Without impression data or keyword research, demand is an assumption.
    const decision = evaluateFacetGate({ ...qualified, hasDocumentedDemand: false });
    expect(decision.gate).toBe("rejected");
    expect(decision.reasons.some((reason) => reason.includes("demand"))).toBe(true);
  });

  it("rejects a thin filter shell with no unique content", () => {
    const decision = evaluateFacetGate({ ...qualified, hasUniqueContent: false });
    expect(decision.gate).toBe("rejected");
    expect(decision.reasons.some((reason) => reason.includes("supporting content"))).toBe(true);
  });

  it("rejects a facet without a stable parameter-free URL", () => {
    // A ?filters=… URL can never qualify, however much inventory it has.
    const decision = evaluateFacetGate({ ...qualified, hasStableUrl: false });
    expect(decision.gate).toBe("rejected");
    expect(decision.reasons.some((reason) => reason.includes("parameter-free"))).toBe(true);
  });

  it("rejects an orphan facet with no parent link", () => {
    const decision = evaluateFacetGate({ ...qualified, hasParentLink: false });
    expect(decision.gate).toBe("rejected");
    expect(decision.reasons.some((reason) => reason.includes("parent hub"))).toBe(true);
  });

  it("reports every failed reason, not just the first", () => {
    // Fixing one thing at a time is how these gates get quietly bypassed.
    const decision = evaluateFacetGate({
      listingCount: 1,
      hasUniqueContent: false,
      hasDocumentedDemand: false,
      hasStableUrl: false,
      hasParentLink: false,
    });
    expect(decision.reasons).toHaveLength(5);
  });

  it("treats a non-numeric listing count as zero rather than passing", () => {
    const decision = evaluateFacetGate({ ...qualified, listingCount: Number.NaN });
    expect(decision.gate).toBe("rejected");
    expect(decision.reasons.some((reason) => reason.includes("has 0"))).toBe(true);
  });

  it("always allows following links, even when refusing to index", () => {
    // Crawl equity must still reach the listings a filtered page links to.
    expect(facetRobots(evaluateFacetGate(qualified))).toEqual({ index: true, follow: true });
    expect(facetRobots(evaluateFacetGate({ ...qualified, hasDocumentedDemand: false }))).toEqual({ index: false, follow: true });
  });
});

describe("paginated canonical policy", () => {
  it("canonicalises page 1 to the clean URL", () => {
    expect(facetCanonicalUrl("/buy/mumbai/andheri-west/3-bhk-flats/")).toMatch(/\/3-bhk-flats\/$/);
    expect(facetCanonicalUrl("/buy/mumbai/andheri-west/3-bhk-flats/", 1)).toBe(
      facetCanonicalUrl("/buy/mumbai/andheri-west/3-bhk-flats/"),
    );
  });

  it("canonicalises deeper pages to themselves, never to page 1", () => {
    // Canonicalising page 2 → page 1 tells Google pages 2..N are duplicates,
    // and anything discovered only on a deeper page is dropped.
    const page2 = facetCanonicalUrl("/buy/mumbai/andheri-west/3-bhk-flats/", 2);
    expect(page2).toContain("?page=2");
    expect(page2).not.toBe(facetCanonicalUrl("/buy/mumbai/andheri-west/3-bhk-flats/", 1));
  });

  it("preserves the trailing-slash canonical policy across pagination", () => {
    expect(facetCanonicalUrl("/search/", 3)).toMatch(/^https:\/\/[^/]+\/search\/\?page=3$/);
  });

  it("ignores invalid page values instead of emitting ?page=NaN", () => {
    expect(facetCanonicalUrl("/search/", Number.NaN)).toBe(facetCanonicalUrl("/search/"));
    expect(facetCanonicalUrl("/search/", 0)).toBe(facetCanonicalUrl("/search/"));
    expect(facetCanonicalUrl("/search/", -4)).toBe(facetCanonicalUrl("/search/"));
    expect(facetCanonicalUrl("/search/", 2.7)).toContain("?page=2");
  });
});
