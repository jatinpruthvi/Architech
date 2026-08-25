/* Pure, testable multi-select filter + sort logic for search. */
import { localityMatchesToken, localityNameMatchesToken } from "@/lib/search/aliases";

export type FilterableProperty = { bhk: number; priceNum: number; badge: string };

export type FilterDef<T extends FilterableProperty> = { id: string; label: string; fn: (p: T) => boolean };

export function makeFilters<T extends FilterableProperty>(): FilterDef<T>[] {
  return [
    { id: "2bhk", label: "2 BHK", fn: (p) => p.bhk === 2 },
    { id: "3bhk", label: "3 BHK +", fn: (p) => p.bhk >= 3 },
    { id: "under15", label: "Under ₹1.5 Cr", fn: (p) => p.priceNum < 15_000_000 },
    { id: "rera", label: "RERA verified", fn: (p) => p.badge === "RERA verified" },
  ];
}

/** AND-combines every active filter; empty selection = all homes. */
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

export function parseFilterParam(param: string | null): string[] {
  if (!param) return [];
  const valid = new Set(makeFilters().map((f) => f.id));
  return param.split(",").filter((id) => valid.has(id));
}

export function serializeFilters(ids: string[]): string {
  return ids.join(",");
}

/* ---------- Free-text query matching (?q=) ---------- */
export type QueryableProperty = { bhk: number; locality: string; title: string; city: string; priceNum: number };

/** Token-AND matching: "2 bhk thaltej" → bhk===2 AND text contains "thaltej".
    "under 1.5 cr" / "under 1 cr" style tokens match price. */
export function matchesQuery<T extends QueryableProperty>(p: T, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystack = `${p.locality} ${p.title} ${p.city}`.toLowerCase();

  // Mixed-language locality matching: a residual token matches if it is an alias
  // (Devanagari, transliterated, or secondary name) for this listing's locality.
  const slug = (p as unknown as { localitySlug?: string }).localitySlug;
  const tokenMatchesLocality = (token: string) =>
    (slug ? localityMatchesToken(slug, token) : false) || localityNameMatchesToken(p.locality, token);

  // BHK pattern anywhere in the query
  const bhkMatch = q.match(/(\d+)\s*bhk/);
  // "under X cr" / "under X crore"
  const underMatch = q.match(/under\s*₹?\s*([\d.]+)\s*(cr|crore|l|lakh)/);

  const residual = q
    .replace(/(\d+)\s*bhk/g, " ")
    .replace(/under\s*₹?\s*([\d.]+)\s*(cr|crore|l|lakh)/g, " ")
    .replace(/near|in|homes?|flats?|apartments?|the/g, " ");

  if (bhkMatch && p.bhk !== parseInt(bhkMatch[1], 10)) return false;
  if (underMatch) {
    const n = parseFloat(underMatch[1]);
    const limit = underMatch[2].startsWith("l") ? n * 100_000 : n * 10_000_000;
    if (p.priceNum >= limit) return false;
  }
  const tokens = residual.split(/[^\p{L}]+/u).filter((t) => t.length > 2);
  return tokens.every((t) => haystack.includes(t) || tokenMatchesLocality(t));
}

export function applyQuery<T extends QueryableProperty>(list: T[], query: string): T[] {
  return list.filter((p) => matchesQuery(p, query));
}
