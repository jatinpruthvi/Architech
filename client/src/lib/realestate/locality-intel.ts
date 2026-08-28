/* Locality intelligence — provenance-labeled market facts for the
   /buy/:city/:locality/ hub.

   Every figure is aggregated only from structured listing facts (price, area,
   BHK, transaction, availability). Nothing is invented, and every figure
   carries the sample it came from so a reader can judge the evidence. A
   locality with no active buy listings returns an honest empty summary rather
   than a promotional number.

   Server-safe: no client directive, no side effects. Deterministic for a given
   fixture set, so it can be unit-tested and SSR'd. */
import { getListingsByLocality, getListings, getLocalityBySlug, type Property } from "@/lib/repositories";
import { compactInr } from "@/lib/realestate/price-trends";

/** Human-readable date the underlying facts were last refreshed.
    Fixtures are static; production sources stamp each update. */
const PRICE_AS_OF = "26 Aug 2026";
const PRICE_AS_OF_ISO = "2026-08-26";

export type BudgetBand = { id: string; label: string; min: number; max: number | null; count: number };
export type BhkSplit = { bhk: number; label: string; count: number };
export type CommuteStop = { place: string; distance: string; category: string };

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

/** Median of a list of finite, positive numbers. */
function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? Math.round((s[mid - 1] + s[mid]) / 2) : s[mid];
}

/** Map a landmark name to a coarse, honest category so the commute band can
    label what kind of stop it is without inventing new places. */
function categorizeLandmark(place: string): string {
  const p = place.toLowerCase();
  if (p.includes("airport") || p.includes("station") || p.includes("metro") || p.includes("brts")) return "transit";
  if (p.includes("hospital") || p.includes("clinic") || p.includes("nursing")) return "health";
  if (p.includes("school") || p.includes("college") || p.includes("iiM") || p.includes("university") || p.includes("academy")) return "learning";
  if (p.includes("garden") || p.includes("park") || p.includes("lake") || p.includes("riverfront")) return "green";
  if (p.includes("hall") || p.includes("museum") || p.includes("gallery") || p.includes("temple")) return "culture";
  return "landmark";
}

function toBuyListing(l: Property): Property | null {
  return (l.transaction ?? "buy") === "buy" ? l : null;
}

/** Build the city-wide average ₹/sq ft from buy listings (used as the position baseline). */
function cityPsf(): number | null {
  const buy = getListings().map(toBuyListing).filter((l): l is Property => l !== null);
  const psf = buy
    .map((l) => (l.areaNum > 0 ? l.priceNum / l.areaNum : NaN))
    .filter((n) => Number.isFinite(n) && n > 0);
  if (psf.length === 0) return null;
  return Math.round(psf.reduce((sum, n) => sum + n, 0) / psf.length);
}

/** Provenance-labeled market facts for a locality (buy-focused). */
export function localityIntel(slug: string): LocalityIntel {
  const locality = getLocalityBySlug(slug);
  const name = locality?.name ?? slug;
  const all = getListingsByLocality(slug);
  const buy = all.map(toBuyListing).filter((l): l is Property => l !== null);
  const rent = all.filter((l) => (l.transaction ?? "buy") === "rent");

  const prices = buy.map((l) => l.priceNum).filter((n) => Number.isFinite(n) && n > 0);
  const psf = buy
    .map((l) => (l.areaNum > 0 ? l.priceNum / l.areaNum : NaN))
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
    count: buy.filter((l) => l.priceNum >= band.min && (band.max === null || l.priceNum < band.max)).length,
  })).filter((band) => band.count > 0);

  const cityMedianPsf = cityPsf();
  const position: LocalityPosition = {
    localityPsf: avgPsf,
    cityPsf: cityMedianPsf,
    deltaPct:
      avgPsf !== null && cityMedianPsf
        ? Math.round(((avgPsf - cityMedianPsf) / cityMedianPsf) * 100)
        : null,
  };

  const commute: CommuteStop[] = (locality?.landmarks ?? []).map(([place, distance]) => ({
    place,
    distance,
    category: categorizeLandmark(place),
  }));

  const newProjectCount = all.filter(
    (l) => l.availability === "NEW_LAUNCH" || l.availability === "UNDER_CONSTRUCTION",
  ).length;

  return {
    slug,
    name,
    buyCount: buy.length,
    rentCount: rent.length,
    minPriceInr: prices.length ? Math.min(...prices) : null,
    medianPriceInr: median(prices),
    maxPriceInr: prices.length ? Math.max(...prices) : null,
    avgPricePerSqftInr: avgPsf,
    newProjectCount,
    byBhk,
    byBudget,
    position,
    commute,
    asOfLabel: PRICE_AS_OF,
    asOfDate: PRICE_AS_OF_ISO,
  };
}

/** Format a ₹/sq ft for a compact label. */
export function formatPsf(value: number | null): string {
  if (value === null) return "—";
  return `₹${Math.round(value).toLocaleString("en-IN")}`;
}

export { compactInr };
