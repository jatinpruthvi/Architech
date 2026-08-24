import { applyFilters, applyQuery, applySort, makeFilters, parseFilterParam, type SortId } from "@/lib/filters";
import { getListings, type Property } from "@/lib/repositories";

export type SearchSource = "fixture-repository" | "postgres-fts-trigram";

export type SearchRequest = {
  q?: string;
  filters?: string[];
  sort?: SortId;
  limit?: number;
};

export type SearchResponse = {
  query: string;
  filters: string[];
  sort: SortId;
  count: number;
  source: SearchSource;
  indexPlan: "deterministic-parser-now-postgres-fts-trigram-next" | "postgres-fts-trigram-ready";
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
  const sort = normalizeSort(request.sort);
  const limit = normalizeLimit(request.limit);

  const defs = makeFilters<Property>();
  const filtered = applySort(applyFilters(applyQuery(getListings(), query), filters, defs), sort);
  const results = typeof limit === "number" ? filtered.slice(0, limit) : filtered;

  return {
    query,
    filters,
    sort,
    count: filtered.length,
    source: "fixture-repository",
    indexPlan: "deterministic-parser-now-postgres-fts-trigram-next",
    results,
  };
}

export function searchListingsFromSearchParams(params: URLSearchParams): SearchResponse {
  return searchListings({
    q: params.get("q") ?? "",
    filters: parseFilterParam(params.get("filters")),
    sort: normalizeSort(params.get("sort")),
    limit: normalizeLimit(params.get("limit")),
  });
}
