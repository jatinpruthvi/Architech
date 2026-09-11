/* Indexability quality gate — the guard that makes programmatic SEO safe.

   StudyArena round-11 contestant C §2 recommends programmatic SEO: a template
   plus a database of variables (property type, neighbourhood, landmark,
   amenity), generating pages like `/villas-near-dps-school-gurgaon`. The
   recommendation itself is sound, and it is also the single fastest way to get
   a site flattened for scaled content abuse — which is why contestant C
   attaches the condition "ensure the data injected into each template is
   unique and valuable".

   This module is that condition, enforced in code.

   WHY THE EVIDENCE BAR IS PER-KIND (read before changing the numbers):

   The original single threshold was `activeListings >= 6`. Wiring it as a flat
   rule would have marked every one of the 72 locality pages non-indexable,
   because the locality inventory distribution is 66 localities with 5 listings
   and 6 with 1. That is not a signal that those pages are thin — a locality
   page with five real homes, its own price facts, PIN codes, commute stops,
   coordinates and editorial note is a genuinely useful page. It is a signal
   that one number cannot serve every page type: the bar that correctly gates a
   mass-generated `landmark × amenity` grid is far too blunt for a place page.

   So the bar is explicit per kind. `programmatic` — the kind contestant C's
   generated pages would land in — keeps the strict original bar. Places are
   judged on whether they have any live inventory plus their own distinct data.

   Honest calibration beats a number that looks strict and silently noindexes
   the site. */

export type PageKind =
  /** A place page: `/buy/{city}/{locality}/`. */
  | "locality"
  /** A property dossier: `/listing/{id}/`. */
  | "listing"
  /** A city or national hub that aggregates places. */
  | "hub"
  /** A standing product page: home, about, contact, tools, list-property. */
  | "standing"
  /** An editorial page: field notes and guides. */
  | "editorial"
  /** A generated combination page — project, landmark, amenity, facet.
      This is where doorway-page risk actually lives. */
  | "programmatic";

export type PageQualityInput = {
  pageKind: PageKind;
  approved: boolean;
  activeListings: number;
  verifiedTransactions: number;
  uniqueWordCount: number;
  hasUniqueData: boolean;
  hasMethodology: boolean;
  hasSourceAndUpdate: boolean;
  hasCanonical: boolean;
  hasParentLink: boolean;
};

export type PageQualityDecision = {
  status: "INDEX" | "HOLD";
  reasons: string[];
  indexable: boolean;
  sitemapEligible: boolean;
};

/** The evidence bar per page kind, with the reason it is set where it is. */
export const EVIDENCE_BAR: Record<PageKind, { label: string; test: (input: PageQualityInput) => boolean }> = {
  locality: {
    label: "at least one live listing plus distinct locality data",
    test: (input) => input.activeListings >= 1 && input.hasUniqueData,
  },
  listing: {
    label: "the listing itself live and sourced",
    test: (input) => input.activeListings >= 1,
  },
  hub: {
    label: "aggregated data of its own",
    test: (input) => input.hasUniqueData,
  },
  standing: {
    label: "distinct purpose and content",
    test: (input) => input.hasUniqueData,
  },
  editorial: {
    label: "substantive reviewed copy, or verified data behind it",
    test: (input) => input.uniqueWordCount >= 300 || input.verifiedTransactions >= 1,
  },
  programmatic: {
    // The strict bar, unchanged: this is the surface that gets mass-generated.
    label: "at least 6 live listings, a verified transaction, or 300 words of unique copy",
    test: (input) => input.activeListings >= 6 || input.verifiedTransactions >= 1 || input.uniqueWordCount >= 300,
  },
};

/**
 * A page may enter the public index only after editorial approval, stable URL
 * ownership, useful evidence, and a data threshold appropriate to its kind.
 * This prevents doorway-page and index-bloat patterns without blocking useful
 * noindex pages.
 *
 * Every failed reason is reported, not just the first, so a page owner sees the
 * whole gap instead of fixing one bar at a time.
 */
export function evaluatePageQuality(input: PageQualityInput): PageQualityDecision {
  const reasons: string[] = [];
  if (!input.approved) reasons.push("Editorial approval is required.");
  if (!input.hasCanonical) reasons.push("A stable canonical URL is required.");
  if (!input.hasParentLink) reasons.push("The page must link to its parent hub.");
  if (!input.hasUniqueData || !input.hasMethodology) reasons.push("Distinct data and methodology are required.");
  if (!input.hasSourceAndUpdate) reasons.push("Source and meaningful update metadata are required.");
  if (!EVIDENCE_BAR[input.pageKind].test(input)) {
    reasons.push(`The page does not meet the ${input.pageKind} evidence bar: ${EVIDENCE_BAR[input.pageKind].label}.`);
  }
  const indexable = reasons.length === 0;
  return { status: indexable ? "INDEX" : "HOLD", reasons, indexable, sitemapEligible: indexable };
}

export function qualityRobots(decision: PageQualityDecision): { index: boolean; follow: boolean } {
  return { index: decision.indexable, follow: true };
}
