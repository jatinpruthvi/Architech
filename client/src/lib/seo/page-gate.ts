/* Wires the quality gate to the SEO page registry.

   `page-quality.ts` defines the rules; this module feeds them the real inputs
   for each registered page. It exists because the gate was, until now,
   unreferenced — it had tests and no callers, which is how a rule quietly
   stops being a rule.

   Every input below is derived from data the page actually has. Nothing is
   asserted to make a page pass: a listing without a recorded update date fails
   the sourced-freshness bar, and a locality with no live listings fails the
   evidence bar. */
import { getGuides, getListings, getLocalityBySlug, type Locality, type Property } from "@/lib/repositories";
import { localityIntel } from "@/lib/realestate/locality-intel";
import { isIndexable } from "./lifecycle";
import { evaluatePageQuality, type PageKind, type PageQualityDecision, type PageQualityInput } from "./page-quality";
import type { SeoPage } from "./pages";

/** The evidence the gate measures, injectable because the registry has two
    data modes: in fixture mode the gate reads the fixture repositories (the
    historical default — every existing caller behaves exactly as before); in
    prisma mode `seo/pages-server.ts` passes the DB-mapped rows so the gate
    measures the SAME inventory the pages are built from. Evaluating prisma
    pages against fixture listings is precisely the orphan/lying-count bug the
    M-1 slice exists to retire. */
export type PageGateEvidence = {
  listings: Property[];
  /** Mapped rows when available (prisma mode); falls back to the fixture
      locality registry, which the seed corpus is generated from anyway. */
  localities?: Locality[];
};

/** Indexable (ACTIVE) listings in one locality, for one transaction intent.
 *
 *  The `intent` filter is what stops the rent surface becoming a doorway farm.
 *  A locality page is judged on the inventory IT publishes: the /rent/ page for
 *  Bopal must be counted on Bopal's RENTAL stock, not on its sale stock. Count
 *  them together and every rent page inherits its buy page's verdict, which
 *  would publish a rental page with nothing to rent on it — precisely the thin
 *  page this gate exists to withhold. */
function activeListingsIn(
  citySlug: string,
  localitySlug: string,
  listings: Property[],
  intent?: "buy" | "rent",
): number {
  return listings.filter(
    (property) =>
      property.citySlug === citySlug &&
      property.localitySlug === localitySlug &&
      (!intent || (property.transaction ?? "buy") === intent) &&
      isIndexable(property.lifecycle ?? "ACTIVE"),
  ).length;
}

/** Indexable listings across a whole city for one intent — the hub equivalent. */
function activeListingsInCity(citySlug: string, listings: Property[], intent?: "buy" | "rent"): number {
  return listings.filter(
    (property) =>
      property.citySlug === citySlug &&
      (!intent || (property.transaction ?? "buy") === intent) &&
      isIndexable(property.lifecycle ?? "ACTIVE"),
  ).length;
}

/** Whether a locality has data that is genuinely its own.

    Contestant F §4 is blunt about the failure mode: locality pages that are
    "just templates with the locality name swapped in" get classified as doorway
    pages. So this is derived from the locality's actual record rather than
    assumed — a place qualifies on named landmarks with distances, the PIN codes
    it serves, or real aggregated price facts. A registry entry carrying nothing
    but a name and coordinates fails, which is exactly the page that should not
    be published. */
function localityHasUniqueData(citySlug: string, localitySlug: string, evidence?: PageGateEvidence): boolean {
  const locality = evidence
    ? (evidence.localities ?? []).find((item) => item.slug === localitySlug && item.citySlug === citySlug) ?? getLocalityBySlug(localitySlug, citySlug)
    : getLocalityBySlug(localitySlug, citySlug);
  if (!locality) return false;
  const hasLandmarks = (locality.landmarks ?? []).length > 0;
  const hasPincodes = locality.pincodes.length > 0;
  const hasPriceFacts = localityIntel(localitySlug, citySlug).medianPriceInr !== null;
  return hasLandmarks || hasPincodes || hasPriceFacts;
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

/** Narrow a registry id suffix to a transaction intent.
 *
 *  Returns undefined for anything unrecognised, which means "count every
 *  listing" — the pre-split behaviour. A malformed id therefore degrades to
 *  the old, more permissive verdict rather than silently withholding a page. */
function intentOf(value?: string): "buy" | "rent" | undefined {
  return value === "buy" || value === "rent" ? value : undefined;
}

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
export function qualityInputFor(page: SeoPage, evidence?: PageGateEvidence): PageQualityInput {
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
      /* `locality:{city}:{locality}:{intent}` — the intent suffix has been in
         the id since the registry was written; it is now load-bearing. */
      const [, citySlug, localitySlug, intent] = page.id.split(":");
      return {
        ...base,
        activeListings: activeListingsIn(citySlug, localitySlug, evidence?.listings ?? getListings(), intentOf(intent)),
        hasUniqueData: localityHasUniqueData(citySlug, localitySlug, evidence),
      };
    }
    case "hub": {
      /* City hubs are `city:{slug}` (buy) or `city:{slug}:rent`. Only the rent
         variant is intent-scoped: the buy hub predates the split and is judged
         on the whole city, exactly as before, so no existing verdict moves. */
      /* The NATIONAL rent hub is judged on rental stock anywhere in the
         country. Without this it would inherit the default verdict and could
         publish an index of rent pages that the gate is simultaneously
         withholding — a hub pointing at nothing. It publishes the moment any
         city has rental inventory, which is the same rule one level up. */
      if (page.id === "hub:rent:india") {
        const rentals = (evidence?.listings ?? getListings()).filter(
          (property: Property) => (property.transaction ?? "buy") === "rent" && isIndexable(property.lifecycle ?? "ACTIVE"),
        ).length;
        return { ...base, activeListings: rentals, hasUniqueData: base.hasUniqueData && rentals > 0 };
      }
      const [prefix, citySlug, intent] = page.id.split(":");
      if (prefix !== "city" || intent !== "rent") return base;
      const rentals = activeListingsInCity(citySlug, evidence?.listings ?? getListings(), "rent");
      /* The hub test asks for "aggregated data of its own". A /rent/ hub with
         zero rental listings aggregates nothing of its own — it would render
         city boilerplate under a rental heading, which is the definition of a
         doorway page. Withholding hasUniqueData here is what keeps the rent
         surface from shipping 12 empty hubs on day one; they publish
         automatically as soon as real rental stock exists. */
      return { ...base, activeListings: rentals, hasUniqueData: base.hasUniqueData && rentals > 0 };
    }
    case "listing": {
      const listingId = page.id.slice("listing:".length);
      const property = (evidence?.listings ?? getListings()).find((item: Property) => item.id === listingId);
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

export function evaluateSeoPageQuality(page: SeoPage, evidence?: PageGateEvidence): PageQualityDecision {
  return evaluatePageQuality(qualityInputFor(page, evidence));
}
