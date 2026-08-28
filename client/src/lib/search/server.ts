import "server-only";
import { applyFilters, applyMarket, applyQuery, applySort, makeFilters, parseFilterParam, type MarketCategory, type MarketIntent } from "@/lib/filters";
import { getListingsForServer } from "@/lib/repositories/server/prisma";
import { getCityBySlug, type Property } from "@/lib/repositories";
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
  const category: MarketCategory = ["all", "residential", "commercial", "pg", "plot", "land", "auction"].includes(request.category ?? "") ? request.category as MarketCategory : "all";
  const intent: MarketIntent = request.intent === "rent" ? "rent" : "buy";
  const sort = normalizeSort(request.sort);
  const pageSize = normalizePageSize(request.limit);
  const page = normalizePage(request.page);
  const listings = await getListingsForServer();
  // Unknown ?city= values fall back to a nationwide search (see search.ts).
  const city = getCityBySlug(request.city)?.slug ?? "all";
  const scoped = city === "all" ? listings : listings.filter((listing) => listing.citySlug === city);
  const defs = makeFilters<Property>();
  const filtered = applySort(applyFilters(applyMarket(applyQuery(scoped, query), category, intent), filters, defs), sort);
  const { items, meta } = paginate(filtered, { page, pageSize });
  const prismaMode = isPrismaSearchSource();

  return {
    query,
    city,
    filters,
    category,
    intent,
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
    city: params.get("city") ?? undefined,
    filters: parseFilterParam(params.get("filters")),
    category: (params.get("category") as MarketCategory) || "all",
    intent: params.get("intent") === "rent" ? "rent" : "buy",
    sort: normalizeSort(params.get("sort")),
    limit: normalizeLimit(params.get("limit")),
    page: Number.parseInt(params.get("page") ?? "", 10) || undefined,
  });
}
