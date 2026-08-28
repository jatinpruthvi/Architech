import { applyFilters, applyMarket, applyQuery, applySort, makeFilters, parseFilterParam, type MarketCategory, type MarketIntent, type SortId } from "@/lib/filters";
import { getCityBySlug, getListings, type Property } from "@/lib/repositories";
import { normalizePage, normalizePageSize, paginate, type PaginationMeta } from "./pagination";

export type SearchSource = "fixture-repository" | "postgres-fts-trigram";

export type SearchRequest = {
  q?: string;
  /** Restrict results to one city slug; omit or "all" to search all of India. */
  city?: string;
  filters?: string[];
  category?: MarketCategory;
  intent?: MarketIntent;
  sort?: SortId;
  limit?: number;
  page?: number;
};

export type SearchResponse = {
  query: string;
  /** Echoes the resolved city scope: a city slug, or "all" for nationwide. */
  city: string;
  filters: string[];
  category: MarketCategory;
  intent: MarketIntent;
  sort: SortId;
  count: number;
  source: SearchSource;
  indexPlan: "deterministic-parser-now-postgres-fts-trigram-next" | "postgres-fts-trigram-ready";
  page: PaginationMeta;
  results: Property[];
};

const VALID_SORTS = new Set<SortId>(["fresh", "price-asc", "price-desc"]);

export function normalizeSort(sort?: string | null): SortId {
  return VALID_SORTS.has(sort as SortId) ? (sort as SortId) : "fresh";
}

export function normalizeLimit(limit?: number | string | null): number | undefined {
  if (limit === undefined || limit === null || limit === "") return undefined;
  const parsed = typeof limit === "number" ? limit : Number.parseInt(limit, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
  return Math.min(parsed, 100);
}

export function searchListings(request: SearchRequest = {}): SearchResponse {
  const query = request.q?.trim() ?? "";
  const filters = request.filters ?? [];
  const category: MarketCategory = ["all", "residential", "commercial", "pg", "plot", "land", "auction"].includes(request.category ?? "") ? request.category as MarketCategory : "all";
  const intent: MarketIntent = request.intent === "rent" ? "rent" : "buy";
  const sort = normalizeSort(request.sort);
  const pageSize = normalizePageSize(request.limit);
  const page = normalizePage(request.page);

  // A city scope is honoured only when it names a known city, so an unknown
  // ?city= value degrades to a nationwide search rather than an empty page.
  const city = getCityBySlug(request.city)?.slug ?? "all";
  const scoped = city === "all" ? getListings() : getListings().filter((listing) => listing.citySlug === city);

  const defs = makeFilters<Property>();
  const filtered = applySort(applyFilters(applyMarket(applyQuery(scoped, query), category, intent), filters, defs), sort);
  const { items, meta } = paginate(filtered, { page, pageSize });

  return {
    query,
    city,
    filters,
    category,
    intent,
    sort,
    count: filtered.length,
    source: "fixture-repository",
    indexPlan: "deterministic-parser-now-postgres-fts-trigram-next",
    page: meta,
    results: items,
  };
}

export function searchListingsFromSearchParams(params: URLSearchParams): SearchResponse {
  return searchListings({
    q: params.get("q") ?? "",
    city: params.get("city") ?? undefined,
    filters: parseFilterParam(params.get("filters")),
    category: (params.get("category") as MarketCategory) || "all",
    intent: params.get("intent") === "rent" ? "rent" : "buy",
    sort: normalizeSort(params.get("sort")),
    limit: normalizeLimit(params.get("limit")),
    page: Number.parseInt(params.get("page") ?? "", 10) || undefined,
  });
}
