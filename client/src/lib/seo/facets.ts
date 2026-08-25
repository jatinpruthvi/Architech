/* Faceted indexability policy (P1-SEO-003).
   Encodes SEO-003: arbitrary facet combinations must not become indexable pages
   unless they pass qualified-intent gates. Search (any combination of query +
   filter + sort + page) is therefore always `noindex` in Phase 1.

   Deterministic and server-safe; referenced by the SEO registry and CI. */

export type FacetIntentGate = "qualified" | "rejected";

export const FACET_POLICY = {
  /** Combination of query + filters + sort + page. */
  maxCombinationSizeForIndexing: -1, // -1 = never indexable in Phase 1
  indexable: false,
} as const;

export function evaluateFacetIndexability(query: string, filters: string[], sort: string): FacetIntentGate {
  // Phase 1: no faceted search result is indexable regardless of content.
  void query;
  void filters;
  void sort;
  return "rejected";
}

export function isFacetIndexable(query: string, filters: string[], sort: string): boolean {
  return evaluateFacetIndexability(query, filters, sort) === "qualified";
}

export function facetIndexability(query: string, filters: string[], sort: string): "indexable" | "noindex" {
  return isFacetIndexable(query, filters, sort) ? "indexable" : "noindex";
}
