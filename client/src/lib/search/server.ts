import "server-only";
import { applyMarket, applyQuery, parseFilterParam, type MarketCategory, type MarketIntent } from "@/lib/filters";
import { getListingsForServer, MAX_UNSCOPED_LISTING_ROWS } from "@/lib/repositories/server/prisma";
import { getCityBySlug } from "@/lib/repositories";
import { listingMatchesPincode, parsePincode } from "@/lib/pincodes";
import { listingWithinBounds, parseBoundsParam } from "@/lib/map";
import { getLocalities } from "@/lib/repositories/localities";
import { buildPostgresSearchPlan } from "./sql";
import { narrowListingIdsForQuery, sqlNarrowEnabled } from "./sql-narrow";
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
  const prismaMode = isPrismaSearchSource();

  /* Executed candidate narrowing (I-7): with the flag on, free-text queries
     are pushed to Postgres FTS/trigram as a candidate SUPERSET and the
     unchanged JS filter runs over those candidates, so recall is provably
     identical while the row read is bounded by SQL instead of the ceiling.
     Off by default; failures fall back loudly. See lib/search/sql.ts. */
  let narrowToIds: string[] | undefined;
  let sqlNarrowState: "off" | "not-required" | "executed" | "fallback" = "off";
  if (prismaMode && sqlNarrowEnabled()) {
    const outcome = await narrowListingIdsForQuery(query);
    sqlNarrowState = outcome.state;
    if (outcome.state === "executed") narrowToIds = outcome.ids;
  }

  /* B-25: the per-city ceiling is the same as the nationwide one, so a huge
     city cannot pull its whole table. `truncated` is now honest for either
     scope — a bounded count is a bounded count, whatever the scope. */
  const listings = await getListingsForServer({ ...(cityScoped ? { citySlug: cityScoped } : { limit: MAX_UNSCOPED_LISTING_ROWS }), narrowToIds });
  const truncated = listings.length >= MAX_UNSCOPED_LISTING_ROWS;

  // A malformed PIN is ignored rather than returning an empty page.
  const pincode = parsePincode(request.pincode);
  const pinned = pincode ? listings.filter((listing) => listingMatchesPincode(listing.localitySlug, pincode)) : listings;

  /* "Search this area" (I-8): locality-marker containment, same helper and
     same fixture-seeded locality registry as the client path — both data
     modes must answer a bounds search identically. */
  const bounds = parseBoundsParam(request.bbox);
  const scoped = bounds ? pinned.filter((listing) => listingWithinBounds(listing, getLocalities(), bounds)) : pinned;

  const groups = facetGroupsFor({ intent, projection });
  const state: FacetState = parseFacetState(tokens.join(","), groups);
  const pooled = applyMarket(applyQuery(scoped, query), category, intent);
  const filtered = applyFacetState(pooled as Property[], state, groups);
  const { items, meta } = paginate(filtered, { page, pageSize });

  /* The plan-executed truth table: `ready` means the scoped bounded read was
     filtered in JS (flag off); `executed` means SQL bounded the read; the
     fallback state is an API-visible signal, never silent — a dashboard that
     watches `indexPlan` sees the library switch the moment it degrades. */
  const indexPlan = !prismaMode
    ? "deterministic-parser-now-postgres-fts-trigram-next" as const
    : sqlNarrowState === "executed"
      ? "postgres-fts-trigram-executed" as const
      : sqlNarrowState === "fallback"
        ? "postgres-fts-trigram-fallback-js" as const
        : "postgres-fts-trigram-ready" as const;

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
      indexPlan,
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
    bbox: params.get("bbox") ?? undefined,
    filters: parseFilterParam(params.get("filters")),
    category: (params.get("category") as MarketCategory) || "all",
    intent: params.get("intent") === "rent" ? "rent" : "buy",
    sort: normalizeSort(params.get("sort")),
    limit: normalizeLimit(params.get("limit")),
    page: Number.parseInt(params.get("page") ?? "", 10) || undefined,
    projection: normalizeProjection(params.get("projection")),
  });
}
