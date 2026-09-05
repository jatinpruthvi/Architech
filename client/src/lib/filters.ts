/* Pure, testable multi-select filter + sort logic for search. */
import { localityMatchesToken, localityNameMatchesToken } from "@/lib/search/aliases";
import { listingMatchesPincode, parsePincode } from "@/lib/pincodes";
import type { AvailabilityCode, PropertyTypeCode } from "@/lib/listing-vocabulary";

export type MarketCategory = "all" | "residential" | "commercial" | "pg" | "plot" | "land" | "auction";
export type MarketIntent = "buy" | "rent";
export type FilterableProperty = { bhk: number; priceNum: number; badge: string; category?: Exclude<MarketCategory, "all">; transaction?: MarketIntent; propertyType?: PropertyTypeCode; availability?: AvailabilityCode };

export type FilterDef<T extends FilterableProperty> = { id: string; label: string; fn: (p: T) => boolean };

export function makeFilters<T extends FilterableProperty>(): FilterDef<T>[] {
  return [
    { id: "2bhk", label: "2 BHK", fn: (p) => p.bhk === 2 },
    { id: "3bhk", label: "3 BHK +", fn: (p) => p.bhk >= 3 },
    { id: "under15", label: "Under ₹1.5 Cr", fn: (p) => p.priceNum < 15_000_000 },
    { id: "rera", label: "RERA verified", fn: (p) => p.badge === "RERA verified" },
    { id: "type-apartment", label: "Apartment / flat", fn: (p) => p.propertyType === "APARTMENT" },
    { id: "type-villa", label: "Villa", fn: (p) => p.propertyType === "VILLA" },
    { id: "type-rowhouse", label: "Rowhouse", fn: (p) => p.propertyType === "ROWHOUSE" },
    { id: "availability-ready", label: "Ready to move", fn: (p) => p.availability === "READY_TO_MOVE" },
    { id: "availability-new", label: "New launch", fn: (p) => p.availability === "NEW_LAUNCH" },
    { id: "availability-resale", label: "Resale", fn: (p) => p.availability === "RESALE" },
  ];
}

/** AND-combines every active filter; empty selection = all homes. */
export function applyMarket<T extends FilterableProperty>(list: T[], category: MarketCategory = "all", intent: MarketIntent = "buy"): T[] {
  return list.filter((property) => (category === "all" || property.category === category) && (property.transaction ?? "buy") === intent);
}

export function applyFilters<T extends FilterableProperty>(list: T[], activeIds: string[], defs = makeFilters<T>()): T[] {
  if (activeIds.length === 0) return list;
  const active = defs.filter((d) => activeIds.includes(d.id));
  return list.filter((p) => active.every((d) => d.fn(p)));
}

export type SortId = "fresh" | "price-asc" | "price-desc";

export function applySort<T extends FilterableProperty>(list: T[], sort: SortId): T[] {
  if (sort === "price-asc") return [...list].sort((a, b) => a.priceNum - b.priceNum);
  if (sort === "price-desc") return [...list].sort((a, b) => b.priceNum - a.priceNum);
  return list; // "fresh" = fixture order (already freshest-first)
}

/**
 * Read the `?filters=` parameter. Two token shapes are legal:
 *   • bare legacy chip ids (`2bhk`) — validated against `makeFilters()`;
 *   • grouped facet tokens (`bhk:2`, `price:9000000-15000000`) — passed through
 *     untouched for `parseFacetState()` to interpret.
 * Grouped tokens MUST survive this function: it sits on the URL-read path for
 * the search API, and dropping them here would silently empty every facet link.
 */
export function parseFilterParam(param: string | null): string[] {
  if (!param) return [];
  const valid = new Set(makeFilters().map((f) => f.id));
  return param.split(",").filter((id) => id.includes(":") || valid.has(id));
}

export function serializeFilters(ids: string[]): string {
  return ids.join(",");
}

/* ---------- Free-text query matching (?q=) ---------- */
export type QueryableProperty = { bhk: number; locality: string; title: string; city: string; priceNum: number; project?: string; developer?: string; subtype?: string };

/** The residual free-text tokens after the structured extractions (PIN, "2 bhk",
    "under 1.5 cr", filler words). Exported because the SQL narrowing path
    (lib/search/server/sql-narrow.ts) MUST use the identical token set or the
    database candidates stop being a superset of the JS result — different
    tokenizers on the two sides is exactly the drift this function exists to
    prevent. \p{M} keeps Devanagari vowel signs attached to their consonant. */
export function queryResidualTokens(query: string): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const residual = q
    .replace(/(?<![0-9])[1-9][0-9]{5}(?![0-9])/g, " ")
    .replace(/(\d+)\s*bhk/g, " ")
    .replace(/under\s*₹?\s*([\d.]+)\s*(cr|crore|l|lakh)/g, " ")
    .replace(/near|in|homes?|flats?|apartments?|the/g, " ");
  return residual.split(/[^\p{L}\p{M}]+/u).filter((t) => t.length > 2);
}

/** Token-AND matching: "2 bhk thaltej" → bhk===2 AND text contains "thaltej".
    "under 1.5 cr" / "under 1 cr" style tokens match price. */
export function matchesQuery<T extends QueryableProperty>(p: T, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystack = `${p.locality} ${p.title} ${p.city} ${p.project ?? ""} ${p.developer ?? ""} ${p.subtype ?? ""}`.toLowerCase();

  // Mixed-language locality matching: a residual token matches if it is an alias
  // (Devanagari, transliterated, or secondary name) for this listing's locality.
  const slug = (p as unknown as { localitySlug?: string }).localitySlug;
  const tokenMatchesLocality = (token: string) =>
    (slug ? localityMatchesToken(slug, token) : false) || localityNameMatchesToken(p.locality, token);

  // A six-digit PIN typed anywhere in the query narrows to localities that
  // actually serve it. Digits are stripped from the residual token pass below,
  // so the PIN must be handled explicitly or it would silently match everything.
  const pincode = parsePincode(q);
  if (pincode && (!slug || !listingMatchesPincode(slug, pincode))) return false;

  // BHK pattern anywhere in the query
  const bhkMatch = q.match(/(\d+)\s*bhk/);
  // "under X cr" / "under X crore"
  const underMatch = q.match(/under\s*₹?\s*([\d.]+)\s*(cr|crore|l|lakh)/);

  if (bhkMatch && p.bhk !== parseInt(bhkMatch[1], 10)) return false;
  if (underMatch) {
    const n = parseFloat(underMatch[1]);
    const limit = underMatch[2].startsWith("l") ? n * 100_000 : n * 10_000_000;
    if (p.priceNum >= limit) return false;
  }
  /* Same tokenizer as the SQL narrowing path — see queryResidualTokens. */
  const tokens = queryResidualTokens(query);
  return tokens.every((t) => haystack.includes(t) || tokenMatchesLocality(t));
}

export function applyQuery<T extends QueryableProperty>(list: T[], query: string): T[] {
  return list.filter((p) => matchesQuery(p, query));
}
