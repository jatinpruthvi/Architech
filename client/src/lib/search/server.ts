import "server-only";
import { applyFilters, applyQuery, applySort, makeFilters, parseFilterParam } from "@/lib/filters";
import { getListingsForServer } from "@/lib/repositories/server/prisma";
import type { Property } from "@/lib/repositories";
import { buildPostgresSearchPlan } from "./sql";
import { isPrismaSearchSource } from "./source";
import { normalizePage, normalizePageSize, paginate } from "./pagination";
import { normalizeLimit, normalizeSort, type SearchRequest, type SearchResponse } from "./search";

export type ServerSearchResponse = SearchResponse & {
  queryPlan?: ReturnType<typeof buildPostgresSearchPlan>;
};

export async function searchListingsForServer(request: SearchRequest = {}): Promise<ServerSearchResponse> {
  const query = request.q?.trim() ?? "";
  const filters = request.filters ?? [];
  const sort = normalizeSort(request.sort);
  const pageSize = normalizePageSize(request.limit);
  const page = normalizePage(request.page);
  const listings = await getListingsForServer();
  const defs = makeFilters<Property>();
  const filtered = applySort(applyFilters(applyQuery(listings, query), filters, defs), sort);
  const { items, meta } = paginate(filtered, { page, pageSize });
  const prismaMode = isPrismaSearchSource();

  return {
    query,
    filters,
    sort,
    count: filtered.length,
    source: prismaMode ? "postgres-fts-trigram" : "fixture-repository",
    indexPlan: prismaMode ? "postgres-fts-trigram-ready" : "deterministic-parser-now-postgres-fts-trigram-next",
    queryPlan: prismaMode ? buildPostgresSearchPlan({ query, filters, sort, limit: pageSize }) : undefined,
    page: meta,
    results: items,
  };
}

export function searchListingsFromSearchParamsForServer(params: URLSearchParams): Promise<ServerSearchResponse> {
  return searchListingsForServer({
    q: params.get("q") ?? "",
    filters: parseFilterParam(params.get("filters")),
    sort: normalizeSort(params.get("sort")),
    limit: normalizeLimit(params.get("limit")),
    page: Number.parseInt(params.get("page") ?? "", 10) || undefined,
  });
}
