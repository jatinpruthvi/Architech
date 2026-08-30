/* City market-trends report — the linkable data asset (StudyArena round-12,
   contestant B §2).

   B's play is sound for a new domain: publish original price/rent data by
   micro-market, and earn citations from local journalists because nobody else
   has the table. The register keeps that recommendation with a gate —
   "methodology, source, sample size, limitations, and update history" — and
   this module is where that gate is enforced rather than described.

   It exists because the obvious version of this page would have shipped a lie.
   Measured against the fixture inventory, Ahmedabad — the launch market — has
   six listings across six localities: one each, and two of them rentals. Every
   other city has thirty. A "2026 Ahmedabad market report" built on that would
   present a single flat's asking price as the median for a neighbourhood, and
   then ask a journalist to cite it. A bad number that gets quoted is worse
   than no number, because it stops being ours.

   So every figure here carries its sample, and a figure below
   `MIN_SAMPLE_FOR_PUBLISHED_STAT` is withheld rather than rounded into
   looking respectable. `publishable` and `blockers` say plainly whether the
   report is fit to put a byline on.

   Built on `price-trends.ts`, which is transaction-aware: rent is never
   aggregated with sale prices. Server-safe and deterministic. */
import { getCityBySlug, getListingsByCity, getLocalities, type Property } from "@/lib/repositories";
import { FIXTURE_AS_OF_ISO, FIXTURE_AS_OF_LABEL } from "@/lib/properties";
import { MIN_SAMPLE_FOR_PUBLISHED_STAT, monthlyRentInr, salePriceInr } from "./price-trends";

export type LocalityMarketRow = {
  slug: string;
  name: string;
  /** Sale listings behind the figures, published or not. */
  saleSampleSize: number;
  rentSampleSize: number;
  medianPriceInr: number | null;
  avgPricePerSqftInr: number | null;
  /** Median asking rent in rupees per month. */
  medianMonthlyRentInr: number | null;
  /** % this locality's average ₹/sqft sits above (+) or below (−) its city. */
  deltaPct: number | null;
  /** False when the sample is too small to publish. The row is still listed so
      the report shows its own coverage gap instead of hiding it. */
  published: boolean;
};

export type MarketTrendCoverage = {
  /** Localities in the city. */
  total: number;
  /** Localities with a sample large enough to publish. */
  published: number;
  /** Localities withheld for a thin sample. */
  withheld: number;
  /** Localities with no sale listing at all — a stronger gap than thin. */
  empty: number;
};

export type CityMarketTrends = {
  citySlug: string;
  cityName: string;
  asOfLabel: string;
  asOfDate: string;
  minSample: number;
  /** Sale listings behind the city-level figures. */
  citySampleSize: number;
  cityMedianPriceInr: number | null;
  cityAvgPricePerSqftInr: number | null;
  cityMedianMonthlyRentInr: number | null;
  cityPublished: boolean;
  localities: LocalityMarketRow[];
  coverage: MarketTrendCoverage;
  /** True only when the city-level figures are publishable. A report can be
      internally consistent and still not be fit to pitch. */
  publishable: boolean;
  /** Every reason it is not publishable, so the gap is a worklist. */
  blockers: string[];
  methodology: string[];
  limitations: string[];
};

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? Math.round((sorted[mid - 1] + sorted[mid]) / 2) : sorted[mid];
}

function isPositive(value: number | null): value is number {
  return value !== null && Number.isFinite(value) && value > 0;
}

function average(values: number[]): number | null {
  return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : null;
}

/** Sale prices, rents and ₹/sqft for a set of listings, split by transaction.

    Splitting first is the whole point: `priceNum` encodes a rental as monthly
    rupees × 100, so a rent figure added to a sale price is not a small error. */
function split(listings: Property[]) {
  const salePrices = listings.map(salePriceInr).filter(isPositive);
  const rents = listings.map(monthlyRentInr).filter(isPositive);
  const psf = listings
    .map((listing) => {
      const price = salePriceInr(listing);
      return price !== null && listing.areaNum > 0 ? price / listing.areaNum : NaN;
    })
    .filter((value) => Number.isFinite(value) && value > 0);
  return { salePrices, rents, psf };
}

/** How the figures are produced. Published with the table, not kept in a
    README: the reader is judging whether to trust these numbers. */
const METHODOLOGY = [
  "Every figure is derived from listings published on Architech, not from registered sale data or a government index.",
  "A locality median is published only when at least three sale listings in that locality contribute to it, and the sample size is shown on every row.",
  "Sale prices and rents are summarised separately and never combined: a rental is monthly, a sale price is capital value.",
  "Average ₹/sq ft is the arithmetic mean of each contributing listing's price divided by its carpet or built-up area as supplied.",
  "The 'vs city' figure compares a locality's average ₹/sq ft with the average across that same city's sale listings.",
];

const LIMITATIONS = [
  "Asking prices, not transacted prices. Indian asking prices typically settle below the quote.",
  "Sample sizes are small and coverage is uneven between cities; a three-listing median is a floor, not a robust central tendency.",
  "Figures describe the inventory Architech has published, which is not a random sample of the market.",
  "No time series is implied: this is a snapshot, so it cannot support an appreciation or trend claim.",
  "Not investment, tax, or legal advice.",
];

/** The market-trends table for one city. */
export function cityMarketTrends(citySlug: string): CityMarketTrends {
  const city = getCityBySlug(citySlug);
  const cityName = city?.name ?? citySlug;
  const listings = getListingsByCity(citySlug);
  const localities = getLocalities(citySlug);

  const citySplit = split(listings);
  const cityAvgPsf = average(citySplit.psf);
  const cityPublished = citySplit.salePrices.length >= MIN_SAMPLE_FOR_PUBLISHED_STAT;

  const rows: LocalityMarketRow[] = localities.map((locality) => {
    const inLocality = listings.filter((listing) => listing.localitySlug === locality.slug);
    const local = split(inLocality);
    const published = local.salePrices.length >= MIN_SAMPLE_FOR_PUBLISHED_STAT;
    const avgPsf = average(local.psf);
    return {
      slug: locality.slug,
      name: locality.name,
      saleSampleSize: local.salePrices.length,
      rentSampleSize: local.rents.length,
      medianPriceInr: published ? median(local.salePrices) : null,
      avgPricePerSqftInr: published ? avgPsf : null,
      medianMonthlyRentInr: local.rents.length >= MIN_SAMPLE_FOR_PUBLISHED_STAT ? median(local.rents) : null,
      deltaPct:
        published && avgPsf !== null && cityAvgPsf ? Math.round(((avgPsf - cityAvgPsf) / cityAvgPsf) * 100) : null,
      published,
    };
  });

  /* The city baseline is the city's own average, so it moves with the same
     sample the locality rows use — a locality is never compared against a
     denominator drawn from a different set of cities. */
  const coverage: MarketTrendCoverage = {
    total: rows.length,
    published: rows.filter((row) => row.published).length,
    withheld: rows.filter((row) => !row.published && row.saleSampleSize > 0).length,
    empty: rows.filter((row) => row.saleSampleSize === 0).length,
  };

  const blockers: string[] = [];
  if (!cityPublished) {
    blockers.push(
      `City figures withheld: ${citySplit.salePrices.length} sale listings, below the ${MIN_SAMPLE_FOR_PUBLISHED_STAT} needed to publish a median.`,
    );
  }
  if (coverage.published === 0) {
    blockers.push("No locality in this city has enough sale listings to publish a median.");
  }

  return {
    citySlug,
    cityName,
    asOfLabel: FIXTURE_AS_OF_LABEL,
    asOfDate: FIXTURE_AS_OF_ISO,
    minSample: MIN_SAMPLE_FOR_PUBLISHED_STAT,
    citySampleSize: citySplit.salePrices.length,
    cityMedianPriceInr: cityPublished ? median(citySplit.salePrices) : null,
    cityAvgPricePerSqftInr: cityPublished ? cityAvgPsf : null,
    cityMedianMonthlyRentInr:
      citySplit.rents.length >= MIN_SAMPLE_FOR_PUBLISHED_STAT ? median(citySplit.rents) : null,
    cityPublished,
    localities: rows,
    coverage,
    publishable: blockers.length === 0,
    blockers,
    methodology: METHODOLOGY,
    limitations: LIMITATIONS,
  };
}

/** Reasons a city's report is not fit to publish or pitch. Empty when it is. */
export function marketTrendBlockers(citySlug: string): string[] {
  return cityMarketTrends(citySlug).blockers;
}
