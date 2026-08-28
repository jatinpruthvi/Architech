import "server-only";
import { applyMarket, applyQuery, parseFilterParam, type MarketCategory, type MarketIntent } from "@/lib/filters";
import { getListingsForServer, MAX_UNSCOPED_LISTING_ROWS } from "@/lib/repositories/server/prisma";
import { getCityBySlug } from "@/lib/repositories";
import { listingMatchesPincode, parsePincode } from "@/lib/pincodes";
import { buildPostgresSearchPlan } from "./sql";
import { isPrismaSearchSource } from "./source";
import { normalizePage, normalizePageSize, paginate } from "./pagination";
import { applyFacetState, parseFacetState, type FacetState } from "./facets";
import type { Property } from "@/lib/repositories";
import {
  facetGroupsFor,
  finalizeSearch,
  normalizeLimit,
  normalizeProjection,
  normalizeSort,
  type FacetProjection,
  type SearchRequest,
  type SearchResponse,
} from "./search";

export type ServerSearchResponse = SearchResponse & {
  queryPlan?: ReturnType<typeof buildPostgresSearchPlan>;
  /** True when the nationwide read hit its row ceiling, so totals are bounded. */
  truncated?: boolean;
};

/**
 * Server search path.
 *
 * Two things changed in the facet rebuild:
 *  1. The city scope is pushed into the data read instead of filtering the
 *     whole table in JS afterwards. Previously `getListingsForServer()` issued
 *     `findMany({ where: { lifecycle: "ACTIVE" } })` — unbounded — and the
 *     result was filtered in-request. Invisible at 24 rows, unpayable at 40k.
 *  2. There is now exactly ONE predicate implementation shared with the client
 *     path (`finalizeSearch` + `applyFacetState`), so the results `/api/search`
 *     returns and the facet counts in its own response cannot drift. The old
 *     code filtered here *and* the caller re-filtered its own copy, which is
 *     precisely how a lying count gets born.
 */
export async function searchListingsForServer(request: SearchRequest = {}): Promise<ServerSearchResponse> {
  const query = request.q?.trim() ?? "";
  const tokens = request.filters ?? [];
  const category: MarketCategory = ["all", "residential", "commercial", "pg", "plot", "land", "auction"].includes(request.category ?? "") ? (request.category as MarketCategory) : "all";
  const intent: MarketIntent = request.intent === "rent" ? "rent" : "buy";
  const projection: FacetProjection = normalizeProjection(request.projection);
  const sort = normalizeSort(request.sort);
  const pageSize = normalizePageSize(request.limit);
  const page = normalizePage(request.page);

  // An unknown ?city= value falls back to a nationwide search (see search.ts) —
  // but "nationwide" is now capped, so the fallback cannot become a full read.
  const city = getCityBySlug(request.city)?.slug ?? "all";
  const cityScoped = city === "all" ? undefined : city;
  const listings = await getListingsForServer(cityScoped ? { citySlug: cityScoped } : { limit: MAX_UNSCOPED_LISTING_ROWS });
  const truncated = !cityScoped && listings.length >= MAX_UNSCOPED_LISTING_ROWS;

  // A malformed PIN is ignored rather than returning an empty page.
  const pincode = parsePincode(request.pincode);
  const scoped = pincode ? listings.filter((listing) => listingMatchesPincode(listing.localitySlug, pincode)) : listings;

  const groups = facetGroupsFor({ intent, projection });
  const state: FacetState = parseFacetState(tokens.join(","), groups);
  const pooled = applyMarket(applyQuery(scoped, query), category, intent);
  const filtered = applyFacetState(pooled as Property[], state, groups);
  const { items, meta } = paginate(filtered, { page, pageSize });
  const prismaMode = isPrismaSearchSource();

  return {
    ...finalizeSearch({
      query,
      city,
      pincode,
      state,
      groups,
      projection,
      category,
      intent,
      sort,
      count: filtered.length,
      meta,
      items,
      pooled,
      source: prismaMode ? "postgres-fts-trigram" : "fixture-repository",
      indexPlan: prismaMode ? "postgres-fts-trigram-ready" : "deterministic-parser-now-postgres-fts-trigram-next",
    }),
    truncated: truncated || undefined,
    // Emitted for the query-plan inspector. Executing this plan against
    // Postgres is the next step of the rebuild and is deliberately NOT faked:
    // until a page query is driven by it, `where` is a description, not a filter.
    queryPlan: prismaMode ? buildPostgresSearchPlan({ query, filters: tokens, sort, limit: pageSize }) : undefined,
  };
}

export function searchListingsFromSearchParamsForServer(params: URLSearchParams): Promise<ServerSearchResponse> {
  return searchListingsForServer({
    q: params.get("q") ?? "",
    city: params.get("city") ?? undefined,
    pincode: params.get("pincode") ?? undefined,
    filters: parseFilterParam(params.get("filters")),
    category: (params.get("category") as MarketCategory) || "all",
    intent: params.get("intent") === "rent" ? "rent" : "buy",
    sort: normalizeSort(params.get("sort")),
    limit: normalizeLimit(params.get("limit")),
    page: Number.parseInt(params.get("page") ?? "", 10) || undefined,
    projection: normalizeProjection(params.get("projection")),
  });
}
