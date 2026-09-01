/* Locality intelligence — provenance-labeled market facts for the
   /buy/:city/:locality/ hub.

   Every figure is aggregated only from structured listing facts (price, area,
   BHK, transaction, availability). Nothing is invented, and every figure
   carries the sample it came from so a reader can judge the evidence. A
   locality with no active buy listings returns an honest empty summary rather
   than a promotional number.

   Server-safe: no client directive, no side effects. Deterministic for a given
   fixture set, so it can be unit-tested and SSR'd. */
import { getListingsByLocality, getListingsByCity, getLocalityBySlug, type Property } from "@/lib/repositories";
import { compactInr } from "@/lib/realestate/format-inr";
import { FIXTURE_AS_OF_ISO, FIXTURE_AS_OF_LABEL } from "@/lib/properties";
import { normalizeAmenities, type AmenityCategory } from "./amenities";
import { MIN_SAMPLE_FOR_PUBLISHED_STAT, monthlyRentInr, salePriceInr } from "./price-trends";

/** Human-readable date the underlying facts were last refreshed.
    Fixtures are static; production sources stamp each update.
    Sourced from the single fixture as-of constant so listing freshness,
    locality facts, and sitemap `lastmod` can never disagree. */
const PRICE_AS_OF = FIXTURE_AS_OF_LABEL;
const PRICE_AS_OF_ISO = FIXTURE_AS_OF_ISO;

export type BudgetBand = { id: string; label: string; min: number; max: number | null; count: number };
export type BhkSplit = { bhk: number; label: string; count: number };
export type CommuteStop = { place: string; distance: string; category: AmenityCategory };

export type LocalityPosition = {
  localityPsf: number | null;
  cityPsf: number | null;
  /** % the locality's median ₹/sq ft sits above (+) or below (−) the city median. */
  deltaPct: number | null;
};

export type LocalityIntel = {
  slug: string;
  name: string;
  /** Active buy listings contributing to the price facts. */
  buyCount: number;
  rentCount: number;
  minPriceInr: number | null;
  medianPriceInr: number | null;
  maxPriceInr: number | null;
  avgPricePerSqftInr: number | null;
  newProjectCount: number;
  byBhk: BhkSplit[];
  byBudget: BudgetBand[];
  position: LocalityPosition;
  /** True when the buy sample is large enough for the price facts above to be
      read as a summary of the locality rather than as one or two asking
      prices. When false they are null on purpose — see `price-trends.ts`. */
  sampleSufficient: boolean;
  /** Median asking rent in rupees per month, or null when the rental sample is
      too small to publish. Never mixed with sale prices. */
  medianMonthlyRentInr: number | null;
  commute: CommuteStop[];
  asOfLabel: string;
  asOfDate: string;
};

const BUDGET_BANDS = [
  { id: "under50l", label: "Under ₹50 L", min: 0, max: 5_000_000 },
  { id: "50l-1cr", label: "₹50 L – 1 Cr", min: 5_000_000, max: 10_000_000 },
  { id: "1cr-1.5cr", label: "₹1 – 1.5 Cr", min: 10_000_000, max: 15_000_000 },
  { id: "1.5cr-2cr", label: "₹1.5 – 2 Cr", min: 15_000_000, max: 20_000_000 },
  { id: "above2cr", label: "Above ₹2 Cr", min: 20_000_000, max: null },
] as const;

/** A usable price: finite and greater than zero. */
function isPositive(value: number | null): value is number {
  return value !== null && Number.isFinite(value) && value > 0;
}

/** Median of a list of finite, positive numbers. */
function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? Math.round((s[mid - 1] + s[mid]) / 2) : s[mid];
}

function toBuyListing(l: Property): Property | null {
  return (l.transaction ?? "buy") === "buy" ? l : null;
}

/** Build the average ₹/sqft for one city from its buy listings.

    Scoped to the city on purpose: the previous version averaged every buy
    listing in the country and the locality page labelled the result "vs city".
    For Thaltej that overstated how far below its market the locality sat — the
    page showed −10% against an all-India baseline of ₹12,059 when the real
    Ahmedabad baseline is ₹11,281 and the honest figure is −4%.

    Returns null when the city has no comparable buy listings, which makes the
    page show "—" rather than a comparison against the wrong denominator. */
function cityPsf(citySlug: string): number | null {
  const buy = getListingsByCity(citySlug).map(toBuyListing).filter((l): l is Property => l !== null);
  const psf = buy
    .map((l) => {
      const price = salePriceInr(l);
      return price !== null && l.areaNum > 0 ? price / l.areaNum : NaN;
    })
    .filter((n) => Number.isFinite(n) && n > 0);
  if (psf.length === 0) return null;
  return Math.round(psf.reduce((sum, n) => sum + n, 0) / psf.length);
}

/** Provenance-labeled market facts for a locality (buy-focused). */
export function localityIntel(slug: string, citySlug?: string): LocalityIntel {
  const locality = getLocalityBySlug(slug, citySlug);
  const name = locality?.name ?? slug;
  const all = getListingsByLocality(slug, citySlug);
  const buy = all.map(toBuyListing).filter((l): l is Property => l !== null);
  const rent = all.filter((l) => (l.transaction ?? "buy") === "rent");

  // Sale prices and rents are read through the unit-aware helpers rather than
  // from `priceNum` directly: a rental is stored as monthly rupees × 100.
  const prices = buy.map(salePriceInr).filter(isPositive);
  const rents = rent.map(monthlyRentInr).filter(isPositive);
  const sampleSufficient = prices.length >= MIN_SAMPLE_FOR_PUBLISHED_STAT;
  const psf = buy
    .map((l) => {
      const price = salePriceInr(l);
      return price !== null && l.areaNum > 0 ? price / l.areaNum : NaN;
    })
    .filter((n) => Number.isFinite(n) && n > 0);
  const avgPsf = psf.length ? Math.round(psf.reduce((sum, n) => sum + n, 0) / psf.length) : null;

  // By BHK (only configurations actually present, ascending).
  const bhkMap = new Map<number, number>();
  for (const l of buy) bhkMap.set(l.bhk, (bhkMap.get(l.bhk) ?? 0) + 1);
  const byBhk: BhkSplit[] = [...bhkMap.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([bhk, count]) => ({ bhk, label: `${bhk} BHK`, count }));

  // By budget band.
  const byBudget: BudgetBand[] = BUDGET_BANDS.map((band) => ({
    ...band,
    count: buy.filter((l) => {
      const price = salePriceInr(l);
      return price !== null && price >= band.min && (band.max === null || price < band.max);
    }).length,
  })).filter((band) => band.count > 0);

  const cityMedianPsf = locality ? cityPsf(locality.citySlug) : null;
  /* The comparison is suppressed along with the other price facts: comparing a
     single home's rate against the city baseline and printing the difference
     as a percentage is the same false precision, with a "vs city" badge on it. */
  const position: LocalityPosition = {
    localityPsf: sampleSufficient ? avgPsf : null,
    cityPsf: sampleSufficient ? cityMedianPsf : null,
    deltaPct:
      sampleSufficient && avgPsf !== null && cityMedianPsf
        ? Math.round(((avgPsf - cityMedianPsf) / cityMedianPsf) * 100)
        : null,
  };

  // Categories come from the amenity data, not from sniffing the place name:
  // `amenities.ts` records why the previous guess was wrong.
  const commute: CommuteStop[] = (normalizeAmenities(locality?.landmarks) ?? []).map((amenity) => ({
    place: amenity.name,
    distance: amenity.distance,
    category: amenity.category,
  }));

  const newProjectCount = all.filter(
    (l) => l.availability === "NEW_LAUNCH" || l.availability === "UNDER_CONSTRUCTION",
  ).length;

  return {
    slug,
    name,
    buyCount: buy.length,
    rentCount: rent.length,
    // Suppressed rather than published thin: a "median" of one listing is that
    // listing's asking price, and the page would present it as a locality
    // summary.
    minPriceInr: sampleSufficient ? Math.min(...prices) : null,
    medianPriceInr: sampleSufficient ? median(prices) : null,
    maxPriceInr: sampleSufficient ? Math.max(...prices) : null,
    avgPricePerSqftInr: sampleSufficient ? avgPsf : null,
    newProjectCount,
    byBhk,
    byBudget,
    position,
    sampleSufficient,
    medianMonthlyRentInr: rents.length >= MIN_SAMPLE_FOR_PUBLISHED_STAT ? median(rents) : null,
    commute,
    asOfLabel: PRICE_AS_OF,
    asOfDate: PRICE_AS_OF_ISO,
  };
}

export { compactInr, formatPsf } from "@/lib/realestate/format-inr";
