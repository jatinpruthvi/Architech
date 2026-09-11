/* Price trends by area (P1-DATA-007).
   Deterministic, server-safe aggregation of listing price facts by locality (or
   city-wide) so buyers/investors can see the shape of a market rather than a
   single price. Derived only from live listing facts — min/median/max price,
   average price-per-sqft, count, and availability mix. Never invents a price or
   a trend; a locality with no listings returns an empty summary.

   Two corrections live here, both found while building the market-report asset
   (StudyArena round-12, contestant B §2):

   1. Sale and rent are no longer aggregated together. `priceNum` encodes a
      rental as *monthly* rupees × 100 and a sale as total rupees, so the two
      are different units. Previously `localityPriceTrends("bopal")` returned
      `medianPriceInr: 2_200_000` for a locality whose only listing is a flat
      renting at ₹22,000/month, and `cityPriceTrends("ahmedabad")` returned a
      median inflated by mixing four sale prices with two of those rentals.
      Rent is now summarised separately, in monthly rupees.

   2. A figure is only published when its sample is large enough to be a
      statistic. A median of one listing is that listing's asking price wearing
      a statistic's clothes; publishing it is worse than publishing nothing,
      because it reads as a market summary.

   The unit encoding itself is pre-existing and has many consumers, so it is
   documented and converted here rather than silently changed. */
import { getCityBySlug, getListingsByCity, getListingsByLocality, type Property } from "@/lib/repositories";
import { compactInr } from "./format-inr";

/** Minimum listings behind an aggregate before it is published.

    Three, because a median needs a middle observation: with one listing the
    "median" is that listing's asking price, and with two it is the mean of two
    asking prices. Neither is a summary of anything.

    Note this is a lower bar than `FACET_POLICY.minListings`, which decides
    whether a whole filtered page is worth indexing. This decides whether a
    single disclosed figure inside a table is arithmetic rather than
    decoration. Every figure published at this floor still carries its sample
    size, so a reader can see it rests on three homes. */
export const MIN_SAMPLE_FOR_PUBLISHED_STAT = 3;

/** `priceNum` stores a rental as monthly rupees × 100 and a sale as total
    rupees (see `property-generator.ts`). Named here so the conversion has one
    documented home instead of a bare `100` at each call site. */
export const RENT_PRICE_SCALE = 100;

function isRent(listing: Property): boolean {
  return (listing.transaction ?? "buy") === "rent";
}

/** Monthly rent in rupees for a rental listing, or null for a sale listing. */
export function monthlyRentInr(listing: Property): number | null {
  if (!isRent(listing)) return null;
  const value = listing.priceNum;
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.round(value / RENT_PRICE_SCALE);
}

/** Total sale price in rupees for a sale listing, or null for a rental. */
export function salePriceInr(listing: Property): number | null {
  if (isRent(listing)) return null;
  const value = listing.priceNum;
  if (!Number.isFinite(value) || value <= 0) return null;
  return value;
}

export type PriceTrendSummary = {
  slug: string;
  name: string;
  /** Every listing in scope, sale and rent. The coverage denominator: a
      locality can hold rentals only, which is not the same as being empty. */
  count: number;
  /** Sale listings behind the price figures. */
  saleSampleSize: number;
  /** Rental listings behind the rent figure. */
  rentSampleSize: number;
  minPriceInr: number | null;
  medianPriceInr: number | null;
  maxPriceInr: number | null;
  avgPricePerSqftInr: number | null;
  /** Median asking rent in rupees per month — never mixed with sale prices. */
  medianMonthlyRentInr: number | null;
  /** Count of listings currently flagged as new launch or under construction. */
  newConstructionCount: number;
  availabilityMix: Record<string, number>;
  /** True when the sale sample clears `MIN_SAMPLE_FOR_PUBLISHED_STAT`. When
      false the price figures are null on purpose, not missing by accident. */
  published: boolean;
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

function summarize(slug: string, name: string, listings: Property[]): PriceTrendSummary {
  /* Sale and rent are separated before anything is computed. Mixing them is
     not a rounding problem — it adds monthly rents to capital values. */
  const sale = listings.filter((listing) => !isRent(listing));
  const rent = listings.filter(isRent);

  const prices = sale.map(salePriceInr).filter(isPositive);
  const psf = sale
    .map((listing) => (listing.areaNum > 0 && isPositive(listing.priceNum) ? listing.priceNum / listing.areaNum : NaN))
    .filter((value) => Number.isFinite(value) && value > 0);
  const rents = rent.map(monthlyRentInr).filter(isPositive);

  const availabilityMix: Record<string, number> = {};
  for (const listing of listings) availabilityMix[listing.availability] = (availabilityMix[listing.availability] ?? 0) + 1;

  const published = prices.length >= MIN_SAMPLE_FOR_PUBLISHED_STAT;
  const rentPublished = rents.length >= MIN_SAMPLE_FOR_PUBLISHED_STAT;

  return {
    slug,
    name,
    count: listings.length,
    saleSampleSize: prices.length,
    rentSampleSize: rents.length,
    minPriceInr: published ? Math.min(...prices) : null,
    medianPriceInr: published ? median(prices) : null,
    maxPriceInr: published ? Math.max(...prices) : null,
    avgPricePerSqftInr: published ? Math.round(psf.reduce((sum, value) => sum + value, 0) / psf.length) : null,
    medianMonthlyRentInr: rentPublished ? median(rents) : null,
    newConstructionCount: listings.filter((listing) => listing.availability === "NEW_LAUNCH" || listing.availability === "UNDER_CONSTRUCTION").length,
    availabilityMix,
    published,
  };
}

/** Price-trend summary for all homes in a locality, scoped to its city. */
export function localityPriceTrends(slug: string, citySlug?: string): PriceTrendSummary {
  const listings = getListingsByLocality(slug, citySlug);
  return summarize(slug, listings[0]?.locality ?? slug, listings);
}

/** City-wide price-trend summary across one city's inventory. */
export function cityPriceTrends(citySlug: string): PriceTrendSummary {
  const city = getCityBySlug(citySlug);
  return summarize(citySlug, city?.name ?? citySlug, getListingsByCity(citySlug));
}

export { compactInr };
