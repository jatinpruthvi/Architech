/* Faceted indexability policy (P1-SEO-003).

   Two rules live here, and they are not in tension:

   1. An arbitrary query + filter + sort + page combination is never indexable.
      Those URLs are infinite, parameterised, and near-duplicate — indexing them
      wastes crawl budget and is the classic route to scaled-content-abuse
      problems.

   2. A *qualified* facet is a real page: enough live listings, its own static
      parameter-free URL, distinct supporting content, evidenced demand, and a
      link back to its parent. Those can be indexed — deliberately, one at a
      time, never by opening the whole filter space.

   StudyArena round-11 contestant B §1 states the qualification bar as
   "≥5 live listings AND real search volume". This module implements exactly
   that, with the demand signal as an explicit input rather than an assumption:
   until there is real Search Console impression data behind a combination,
   `hasDocumentedDemand` is false and the gate stays shut. That is the point —
   the gate is ready, not open.

   Deterministic and server-safe; referenced by the SEO registry and CI. */
import { paginatedCanonicalUrl } from "./urls";

export type FacetIntentGate = "qualified" | "rejected";

export const FACET_POLICY = {
  /** -1 = no arbitrary query + filter + sort combination is indexable. */
  maxCombinationSizeForIndexing: -1,
  indexable: false,
  /** Live listings a combination must surface before it can be a real page.
      Below this it is a thin filter shell, and indexing it is index bloat. */
  minListings: 5,
  /** Demand must be evidenced by impression data or keyword research — never
      assumed from "someone might search this". */
  requireDocumentedDemand: true,
} as const;

export type FacetIndexabilityInput = {
  /** Live listings the combination would actually show. */
  listingCount: number;
  /** Distinct supporting content — editorial, data blocks, methodology — beyond
      a re-filtered card grid. */
  hasUniqueContent: boolean;
  /** Demand evidenced by Search Console impressions or keyword research. */
  hasDocumentedDemand: boolean;
  /** A static, lowercase, parameter-free URL owned by this page. */
  hasStableUrl: boolean;
  /** Links to its parent hub (and siblings), so it is not an orphan. */
  hasParentLink: boolean;
};

export type FacetGateDecision = {
  gate: FacetIntentGate;
  indexable: boolean;
  reasons: string[];
};

/** Evaluate whether one facet combination deserves to be indexed.

    Returns every failed reason rather than short-circuiting, so a page owner
    can see the full gap instead of fixing one thing at a time. */
export function evaluateFacetGate(input: FacetIndexabilityInput): FacetGateDecision {
  const reasons: string[] = [];

  if (!input.hasStableUrl) reasons.push("Needs a static, parameter-free URL of its own.");
  if (!Number.isFinite(input.listingCount) || input.listingCount < FACET_POLICY.minListings) {
    reasons.push(`Needs at least ${FACET_POLICY.minListings} live listings (has ${Number.isFinite(input.listingCount) ? input.listingCount : 0}).`);
  }
  if (!input.hasUniqueContent) reasons.push("Needs supporting content beyond a re-filtered listing grid.");
  if (!input.hasParentLink) reasons.push("Needs a link to its parent hub.");
  if (FACET_POLICY.requireDocumentedDemand && !input.hasDocumentedDemand) {
    reasons.push("Needs evidenced search demand (Search Console impressions or documented keyword research).");
  }

  const qualified = reasons.length === 0;
  return {
    gate: qualified ? "qualified" : "rejected",
    indexable: qualified,
    reasons,
  };
}

/** A `/search?...` URL is by definition a parameterised combination: it has no
    stable URL of its own, no content beyond the filtered grid, and no evidenced
    demand. It can never qualify, regardless of what is passed in. */
export function evaluateFacetIndexability(query: string, filters: string[], sort: string): FacetIntentGate {
  void query;
  void filters;
  void sort;
  return evaluateFacetGate({
    listingCount: 0,
    hasUniqueContent: false,
    hasDocumentedDemand: false,
    hasStableUrl: false,
    hasParentLink: false,
  }).gate;
}

export function isFacetIndexable(query: string, filters: string[], sort: string): boolean {
  return evaluateFacetIndexability(query, filters, sort) === "qualified";
}

export function facetIndexability(query: string, filters: string[], sort: string): "indexable" | "noindex" {
  return isFacetIndexable(query, filters, sort) ? "indexable" : "noindex";
}

/** Robots for a faceted page. `follow` is always true: even a page we refuse to
    index must still pass crawl equity through to the listings it links to. */
export function facetRobots(decision: FacetGateDecision): { index: boolean; follow: boolean } {
  return { index: decision.indexable, follow: true };
}

/** Canonical for a *qualified* facet page — one that has passed
    `evaluateFacetGate` and therefore has a stable, parameter-free URL.

    Self-referential on every page of pagination, so `/…/3-bhk-flats/?page=2`
    owns itself instead of collapsing into page 1 and hiding everything only
    reachable from deeper pages. */
export function facetCanonicalUrl(path: string, page?: number): string {
  return paginatedCanonicalUrl(path, page);
}
