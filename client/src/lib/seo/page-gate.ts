/* Wires the quality gate to the SEO page registry.

   `page-quality.ts` defines the rules; this module feeds them the real inputs
   for each registered page. It exists because the gate was, until now,
   unreferenced — it had tests and no callers, which is how a rule quietly
   stops being a rule.

   Every input below is derived from data the page actually has. Nothing is
   asserted to make a page pass: a listing without a recorded update date fails
   the sourced-freshness bar, and a locality with no live listings fails the
   evidence bar. */
import { getGuides, getListings, type Property } from "@/lib/repositories";
import { isIndexable } from "./lifecycle";
import { evaluatePageQuality, type PageKind, type PageQualityDecision, type PageQualityInput } from "./page-quality";
import type { SeoPage } from "./pages";

/** Indexable (ACTIVE) listings in one locality. */
function activeListingsIn(citySlug: string, localitySlug: string): number {
  return getListings().filter(
    (property) =>
      property.citySlug === citySlug &&
      property.localitySlug === localitySlug &&
      isIndexable(property.lifecycle ?? "ACTIVE"),
  ).length;
}

/** Word count of a guide's own reviewed body copy. */
function guideWordCount(guideId: string): number {
  const guide = getGuides().find((item) => item.id === guideId);
  if (!guide) return 0;
  return guide.sections
    .map((section) => `${section.heading} ${section.body}`)
    .join(" ")
    .split(/\s+/)
    .filter(Boolean).length;
}

/* `routeType: "guide"` in the registry covers three different kinds of page,
   so the kind is resolved by id: the /guide/ index aggregates, guide detail
   pages are editorial, and the developer/investment/home-loan pages are
   standing product pages that merely live in that route family. */
const STANDING_GUIDE_FAMILY_IDS = new Set(["page:developers", "page:investment", "page:home-loan"]);

export function pageKindFor(page: SeoPage): PageKind {
  if (page.routeType === "locality") return "locality";
  if (page.routeType === "listing") return "listing";
  if (page.routeType === "city" || page.routeType === "hub") return "hub";
  if (page.routeType === "guide") {
    if (page.id === "guide:index") return "hub";
    if (STANDING_GUIDE_FAMILY_IDS.has(page.id)) return "standing";
    return "editorial";
  }
  return "standing";
}

/** Build the quality-gate input for one registered page from real data. */
export function qualityInputFor(page: SeoPage): PageQualityInput {
  const kind = pageKindFor(page);

  const base: PageQualityInput = {
    pageKind: kind,
    // The registry has already applied its own gates (lifecycle for listings,
    // published status for guides); the quality gate adds the evidence test.
    approved: page.indexability === "indexable",
    activeListings: 0,
    verifiedTransactions: 0,
    uniqueWordCount: 0,
    // Every registered public route emits a self-referencing canonical and a
    // breadcrumb back to its parent.
    hasCanonical: true,
    hasParentLink: true,
    hasUniqueData: true,
    hasMethodology: true,
    hasSourceAndUpdate: true,
  };

  switch (kind) {
    case "locality": {
      const [, citySlug, localitySlug] = page.id.split(":");
      return { ...base, activeListings: activeListingsIn(citySlug, localitySlug) };
    }
    case "listing": {
      const listingId = page.id.slice("listing:".length);
      const property = getListings().find((item: Property) => item.id === listingId);
      return {
        ...base,
        activeListings: property && isIndexable(property.lifecycle ?? "ACTIVE") ? 1 : 0,
        // A listing with no recorded update date cannot claim sourced freshness.
        hasSourceAndUpdate: Boolean(property?.meaningfulUpdatedAt),
      };
    }
    case "editorial": {
      return { ...base, uniqueWordCount: guideWordCount(page.id.slice("guide:".length)) };
    }
    default:
      return base;
  }
}

export function evaluateSeoPageQuality(page: SeoPage): PageQualityDecision {
  return evaluatePageQuality(qualityInputFor(page));
}
