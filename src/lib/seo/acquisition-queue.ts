/* The acquisition queue — what to source next, and what it unlocks.

   Most SEO reporting is a scoreboard: here is where you rank. This module
   answers the harder question behind it: **what is the next listing worth?**

   The site's publication rules are thresholds, and every threshold is
   arithmetic against the inventory. `MIN_SAMPLE_FOR_PUBLISHED_STAT` says a
   locality needs three sale listings before its median and rate per square
   foot may be printed. `cityMarketTrends().publishable` adds that at least one
   locality in the city must clear it. `EVIDENCE_BAR.programmatic` wants six
   live listings before a generated page may be indexed at all.

   Because they are arithmetic, the distance to each one is *computable*, and
   so is what flips when it closes. That turns SEO from a report into a
   worklist: not "Ahmedabad is underperforming" but "two sale listings in
   Paldi publish the Ahmedabad price index".

   The asymmetry is the point. One listing page can at best rank for its own
   entity — a handful of searches a month. Two listings in the right locality
   publish a whole city's price index, put figures on six locality pages that
   currently print nothing, and add a page that earns links. Same two
   listings, wildly different return, and only the second one is knowable in
   advance.

   Nothing here guesses at demand or promises a ranking. It reads the gates
   the site already enforces and reports the shortest arithmetic path through
   them. */
import { getCities, getLocalities } from "@/lib/repositories";
import { cityMarketTrends } from "@/lib/realestate/market-trends";
import { localityPriceTrends, MIN_SAMPLE_FOR_PUBLISHED_STAT } from "@/lib/realestate/price-trends";

/** Live listings a generated page needs before it may be indexed at all.
    Mirrors `EVIDENCE_BAR.programmatic`, which also accepts a verified
    transaction or 300 words — neither of which can be sourced by a broker,
    so listings are the lever this queue reports on. */
/* The permission required to read the acquisition queue.

   Deliberately not a new permission. The queue is coverage and inventory
   arithmetic shown to the same operational audience that works the
   moderation queue; a dedicated permission would cost a roles migration and
   buy no access-control benefit, because anyone who can see the moderation
   queue can already infer coverage from it.

   Exported as a constant rather than inlined in the route so this decision is
   pinned by a test. If it is ever narrowed, the test fails here rather than
   the change landing silently. See docs/seo/seo-os-decisions.md. */
export const ACQUISITION_READ_PERMISSION = "moderation.queue.read";

export const PROGRAMMATIC_BAR_LISTINGS = 6;

export type LocalityAsk = {
  localitySlug: string;
  localityName: string;
  /** Sale listings behind the price figures today. */
  saleSampleSize: number;
  rentSampleSize: number;
  /** Sale listings still needed before a median and ₹/sq ft may be printed. */
  saleGap: number;
  /** Rental listings still needed before a median rent may be printed. */
  rentGap: number;
  publishesPrice: boolean;
  publishesRent: boolean;
  /** Listings still needed before a generated page on this locality could be
      indexed. Zero does not mean one may be built — the bar also needs unique
      data — only that inventory is no longer the blocker. */
  programmaticGap: number;
};

export type CityAcquisitionPlan = {
  citySlug: string;
  cityName: string;
  /** True when the city's price index is published today. */
  publishable: boolean;
  blockers: readonly string[];
  localitiesPublishing: number;
  localitiesTotal: number;
  /** The cheapest route to publishing the city index: the smallest number of
      listings, in the fewest localities, that gets at least one locality over
      the bar. Empty when the index already publishes. */
  minimumToPublish: { gap: number; localities: string[] };
  /** What it takes to put figures on every locality in the city. */
  fullCoverage: { gap: number; localities: string[] };
  localities: LocalityAsk[];
};

function localityAsk(citySlug: string, localitySlug: string, localityName: string): LocalityAsk {
  const trends = localityPriceTrends(localitySlug, citySlug);
  const saleGap = Math.max(0, MIN_SAMPLE_FOR_PUBLISHED_STAT - trends.saleSampleSize);
  const rentGap = Math.max(0, MIN_SAMPLE_FOR_PUBLISHED_STAT - trends.rentSampleSize);
  return {
    localitySlug,
    localityName,
    saleSampleSize: trends.saleSampleSize,
    rentSampleSize: trends.rentSampleSize,
    saleGap,
    rentGap,
    publishesPrice: trends.published,
    publishesRent: trends.medianMonthlyRentInr !== null,
    // `count` is every listing in the locality, sale and rent: the evidence
    // bar counts live inventory, not the sale-only sample.
    programmaticGap: Math.max(0, PROGRAMMATIC_BAR_LISTINGS - trends.count),
  };
}

/** What one city needs, and the shortest path to publishing its index. */
export function cityAcquisitionPlan(citySlug: string): CityAcquisitionPlan {
  const city = getCities().find((entry) => entry.slug === citySlug);
  const cityName = city?.name ?? citySlug;
  const report = cityMarketTrends(citySlug);
  const localities = getLocalities(citySlug).map((locality) => localityAsk(citySlug, locality.slug, locality.name));

  /* Cheapest first. To publish the index only ONE locality has to clear the
     bar, so the minimum ask is the locality closest to it — not the sum of
     every gap in the city. Reporting the sum here would overstate the cost of
     the unlock by an order of magnitude and bury the cheapest win. */
  const cheapest = [...localities].filter((ask) => ask.saleGap > 0).sort((a, b) => a.saleGap - b.saleGap)[0];
  const behind = localities.filter((ask) => ask.saleGap > 0);

  return {
    citySlug,
    cityName,
    publishable: report.publishable,
    blockers: report.blockers,
    localitiesPublishing: report.coverage.published,
    localitiesTotal: report.coverage.total,
    minimumToPublish: report.publishable
      ? { gap: 0, localities: [] }
      : { gap: cheapest?.saleGap ?? 0, localities: cheapest ? [cheapest.localityName] : [] },
    fullCoverage: {
      gap: behind.reduce((sum, ask) => sum + ask.saleGap, 0),
      localities: behind.map((ask) => ask.localityName),
    },
    localities,
  };
}

/** Every city, ranked so the cheapest unlock in the country is first. */
export function acquisitionQueue(): CityAcquisitionPlan[] {
  return getCities()
    .map((city) => cityAcquisitionPlan(city.slug))
    .sort((a, b) => {
      // A city whose index is withheld outranks one that is merely incomplete:
      // publishing a whole page beats adding one more figure to a live one.
      if (a.publishable !== b.publishable) return a.publishable ? 1 : -1;
      return a.minimumToPublish.gap - b.minimumToPublish.gap || a.fullCoverage.gap - b.fullCoverage.gap;
    });
}

export type AcquisitionHeadline = {
  /** The single cheapest action anywhere on the site that publishes a page. */
  action: string;
  listings: number;
  /** What stops being withheld when it is done. */
  unlocks: string[];
} | null;

/** One sentence a sourcing lead can act on, or null when nothing is gated. */
export function acquisitionHeadline(): AcquisitionHeadline {
  const next = acquisitionQueue().find((plan) => !plan.publishable && plan.minimumToPublish.gap > 0);
  if (!next) return null;
  return {
    action: `${next.minimumToPublish.gap} sale listing${next.minimumToPublish.gap === 1 ? "" : "s"} in ${next.minimumToPublish.localities.join(" or ")}, ${next.cityName}`,
    listings: next.minimumToPublish.gap,
    unlocks: [
      `the ${next.cityName} property price index, currently withheld`,
      "a new entry in the reports sitemap",
      ...(next.blockers.length ? [next.blockers[0]!.replace(/^./, (c) => c.toLowerCase()).replace(/\.$/, "")] : []),
    ],
  };
}
