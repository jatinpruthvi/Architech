/* Price trends by area (P1-DATA-007).
   Deterministic, server-safe aggregation of listing price facts by locality (or
   city-wide) so buyers/investors can see the shape of a market rather than a
   single price. Derived only from live listing facts — min/median/max price,
   average price-per-sqft, count, and availability mix. Never invents a price or
   a trend; a locality with no listings returns an empty summary. */

import { getListings, getListingsByLocality, type Property } from "@/lib/repositories";

export type PriceTrendSummary = {
  slug: string;
  name: string;
  count: number;
  minPriceInr: number | null;
  medianPriceInr: number | null;
  maxPriceInr: number | null;
  avgPricePerSqftInr: number | null;
  /** Count of listings currently flagged as new launch or under construction. */
  newConstructionCount: number;
  availabilityMix: Record<string, number>;
};

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? Math.round((sorted[mid - 1] + sorted[mid]) / 2) : sorted[mid];
}

function summarize(slug: string, name: string, listings: Property[]): PriceTrendSummary {
  const prices = listings.map((listing) => listing.priceNum).filter((value) => Number.isFinite(value) && value > 0);
  const psf = listings
    .map((listing) => (listing.areaNum > 0 ? listing.priceNum / listing.areaNum : NaN))
    .filter((value) => Number.isFinite(value) && value > 0);

  const availabilityMix: Record<string, number> = {};
  for (const listing of listings) availabilityMix[listing.availability] = (availabilityMix[listing.availability] ?? 0) + 1;

  return {
    slug,
    name,
    count: listings.length,
    minPriceInr: prices.length ? Math.min(...prices) : null,
    medianPriceInr: median(prices),
    maxPriceInr: prices.length ? Math.max(...prices) : null,
    avgPricePerSqftInr: psf.length ? Math.round(psf.reduce((sum, value) => sum + value, 0) / psf.length) : null,
    newConstructionCount: listings.filter((listing) => listing.availability === "NEW_LAUNCH" || listing.availability === "UNDER_CONSTRUCTION").length,
    availabilityMix,
  };
}

/** Price-trend summary for all homes in a locality. */
export function localityPriceTrends(slug: string): PriceTrendSummary {
  const listings = getListingsByLocality(slug);
  return summarize(slug, listings[0]?.locality ?? slug, listings);
}

/** City-wide price-trend summary across the whole inventory. */
export function cityPriceTrends(): PriceTrendSummary {
  return summarize("ahmedabad", "Ahmedabad", getListings());
}

/** Human-readable INR label for a price value. */
export function compactInr(value: number | null): string {
  if (value === null) return "—";
  if (value >= 10_000_000) return `₹${(value / 10_000_000).toFixed(2)} Cr`;
  if (value >= 100_000) return `₹${(value / 100_000).toFixed(1)} L`;
  return `₹${value.toLocaleString("en-IN")}`;
}
