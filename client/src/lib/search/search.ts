import { applyFilters, applyQuery, applySort, makeFilters, parseFilterParam, type SortId } from "@/lib/filters";
import { getListings, type Property } from "@/lib/repositories";
import { normalizePage, normalizePageSize, paginate, type PaginationMeta } from "./pagination";

export type SearchSource = "fixture-repository" | "postgres-fts-trigram";

export type SearchRequest = {
  q?: string;
  filters?: string[];
  sort?: SortId;
  limit?: number;
  page?: number;
};

export type SearchResponse = {
  query: string;
  filters: string[];
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
  const sort = normalizeSort(request.sort);
  const pageSize = normalizePageSize(request.limit);
  const page = normalizePage(request.page);

  const defs = makeFilters<Property>();
  const filtered = applySort(applyFilters(applyQuery(getListings(), query), filters, defs), sort);
  const { items, meta } = paginate(filtered, { page, pageSize });

  return {
    query,
    filters,
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
    filters: parseFilterParam(params.get("filters")),
    sort: normalizeSort(params.get("sort")),
    limit: normalizeLimit(params.get("limit")),
    page: Number.parseInt(params.get("page") ?? "", 10) || undefined,
  });
}
