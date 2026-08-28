import { applyMarket, applyQuery, applySort, type MarketCategory, type MarketIntent, type SortId } from "@/lib/filters";
import { getCityBySlug, getListings, type Property } from "@/lib/repositories";
import { listingMatchesPincode, parsePincode } from "@/lib/pincodes";
import { normalizePage, normalizePageSize, paginate, type PaginationMeta } from "./pagination";
import {
  activeFacetCount,
  applyFacetState,
  computeFacetCounts,
  computeRelaxations,
  facetGroups,
  groupsForProjection,
  isFacetStateEmpty,
  parseFacetState,
  serializeFacetState,
  wideningSuggestions,
  type DerivedFacetValue,
  type FacetCounts,
  type FacetGroup,
  type FacetState,
  type Relaxation,
} from "./facets";

export type SearchSource = "fixture-repository" | "postgres-fts-trigram";
export type FacetProjection = "consumer" | "desk";

export type SearchRequest = {
  q?: string;
  /** Restrict results to one city slug; omit or "all" to search all of India. */
  city?: string;
  /** Restrict results to localities serving this PIN code. */
  pincode?: string;
  /**
   * `group:value` tokens (see `facets.ts`). Bare legacy chip ids are still
   * accepted and mapped onto groups, so links shared before the facet rebuild
   * keep returning the same inventory.
   */
  filters?: string[];
  category?: MarketCategory;
  intent?: MarketIntent;
  sort?: SortId;
  limit?: number;
  page?: number;
  /** Which facet groups the response describes. Desk callers get every group. */
  projection?: FacetProjection;
};

export type AppliedFacet = { groupId: string; groupLabel: string; valueId: string; label: string };

export type SearchResponse = {
  query: string;
  /** Echoes the resolved city scope: a city slug, or "all" for nationwide. */
  city: string;
  /** Echoes the resolved PIN filter, or null when none was applied. */
  pincode: string | null;
  /** Canonical serialisation of the active facet state. */
  filters: string[];
  category: MarketCategory;
  intent: MarketIntent;
  sort: SortId;
  count: number;
  source: SearchSource;
  indexPlan: "deterministic-parser-now-postgres-fts-trigram-next" | "postgres-fts-trigram-ready";
  page: PaginationMeta;
  results: Property[];
  /** --- facet rebuild --- */
  projection: FacetProjection;
  facets: FacetCounts;
  /** What is currently applied, in display order. */
  applied: AppliedFacet[];
  /** Zero-result ladder rung 1: the single constraint that costs the most. */
  relaxations: Relaxation[];
  /** Zero-result ladder rung 2: nearest localities with real inventory. */
  widening: DerivedFacetValue[];
};

// Deliberately not widened to a "relevance" sort yet: applySort has no
// relevance implementation, so advertising it would silently mean "fresh".
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

export function normalizeProjection(projection?: string | null): FacetProjection {
  return projection === "desk" ? "desk" : "consumer";
}

/**
 * Resolve the groups in play for a request. Kept in one place so the counts the
 * UI renders and the filter that produces `results` can never disagree — a
 * facet count that lies is worse than no count at all.
 */
export function facetGroupsFor(request: Pick<SearchRequest, "intent" | "projection">): FacetGroup[] {
  const groups = facetGroups({ intent: request.intent === "rent" ? "rent" : "buy" });
  return groupsForProjection(groups, normalizeProjection(request.projection));
}

export function searchListings(request: SearchRequest = {}): SearchResponse {
  const query = request.q?.trim() ?? "";
  const tokens = request.filters ?? [];
  const category: MarketCategory = ["all", "residential", "commercial", "pg", "plot", "land", "auction"].includes(request.category ?? "") ? (request.category as MarketCategory) : "all";
  const intent: MarketIntent = request.intent === "rent" ? "rent" : "buy";
  const projection = normalizeProjection(request.projection);
  const sort = normalizeSort(request.sort);
  const pageSize = normalizePageSize(request.limit);
  const page = normalizePage(request.page);

  // A city scope is honoured only when it names a known city, so an unknown
  // ?city= value degrades to a nationwide search rather than an empty page.
  const city = getCityBySlug(request.city)?.slug ?? "all";
  const byCity = city === "all" ? getListings() : getListings().filter((listing) => listing.citySlug === city);

  // A malformed PIN is ignored rather than returning an empty page.
  const pincode = parsePincode(request.pincode);
  const scoped = pincode ? byCity.filter((listing) => listingMatchesPincode(listing.localitySlug, pincode)) : byCity;

  const groups = facetGroupsFor({ intent, projection });
  const state = parseFacetState(tokens.join(","), groups);
  const pooled = applyMarket(applyQuery(scoped, query), category, intent);
  const filtered = applySort(applyFacetState(pooled, state, groups), sort);
  const { items, meta } = paginate(filtered, { page, pageSize });

  return finalizeSearch({
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
    source: "fixture-repository",
    indexPlan: "deterministic-parser-now-postgres-fts-trigram-next",
  });
}

/**
 * Shared tail of every search path. Facet counts, applied labels and the
 * zero-result ladder are all derived here from the SAME `state` and `groups`,
 * so `facets.*.count` is by construction what clicking that option yields.
 */
export function finalizeSearch(input: {
  query: string;
  city: string;
  pincode: string | null;
  state: FacetState;
  groups: FacetGroup[];
  projection: FacetProjection;
  category: MarketCategory;
  intent: MarketIntent;
  sort: SortId;
  count: number;
  meta: PaginationMeta;
  items: Property[];
  /** Post-query/market/pincode scope, pre-facet — what counts are measured over. */
  pooled: Property[];
  source: SearchSource;
  indexPlan: SearchResponse["indexPlan"];
}): SearchResponse {
  const { state, groups } = input;
  const facets = computeFacetCounts(input.pooled, state, groups);
  const applied = appliedFacets(state, groups, facets);
  const empty = input.count === 0 && !isFacetStateEmpty(state);
  return {
    query: input.query,
    city: input.city,
    pincode: input.pincode,
    filters: serializeFacetState(state) ? serializeFacetState(state).split(",") : [],
    category: input.category,
    intent: input.intent,
    sort: input.sort,
    count: input.count,
    source: input.source,
    indexPlan: input.indexPlan,
    page: input.meta,
    results: input.items,
    projection: input.projection,
    facets,
    applied,
    relaxations: empty ? computeRelaxations(input.pooled, state, groups) : [],
    widening: empty ? wideningSuggestions(input.pooled, state, groups) : [],
  };
}

/**
 * Display list of active constraints, in group order.
 * Labels come from `facets` (the count map) rather than the static schema, so a
 * derived locality id renders its real inventory name instead of a prettified
 * slug — and any option the inventory does not know about still gets a label.
 */
export function appliedFacets(state: FacetState, groups: FacetGroup[], facets: FacetCounts): AppliedFacet[] {
  const applied: AppliedFacet[] = [];
  for (const group of groups) {
    if (group.kind === "range") {
      const range = state.ranges[group.id];
      if (!range || !group.range) continue;
      applied.push({
        groupId: group.id,
        groupLabel: group.label,
        valueId: `${range.from}-${range.to}`,
        label: `${group.range.format(range.from)} – ${group.range.format(range.to)}`,
      });
      continue;
    }
    const options = facets[group.id]?.options ?? [];
    for (const id of state.multi[group.id] ?? []) {
      applied.push({
        groupId: group.id,
        groupLabel: group.label,
        valueId: id,
        label: options.find((option) => option.id === id)?.label ?? humanise(id),
      });
    }
  }
  return applied;
}

const humanise = (id: string) => id.replace(/[-_]/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());

export function searchListingsFromSearchParams(params: URLSearchParams): SearchResponse {
  return searchListings({
    q: params.get("q") ?? "",
    city: params.get("city") ?? undefined,
    pincode: params.get("pincode") ?? undefined,
    // Raw token pass-through: legacy chip ids and `group:value` tokens are both
    // interpreted downstream by `parseFacetState`, so nothing is dropped here.
    filters: (params.get("filters") ?? "").split(",").map((token) => token.trim()).filter(Boolean),
    category: (params.get("category") as MarketCategory) || "all",
    intent: params.get("intent") === "rent" ? "rent" : "buy",
    sort: normalizeSort(params.get("sort")),
    limit: normalizeLimit(params.get("limit")),
    page: Number.parseInt(params.get("page") ?? "", 10) || undefined,
    projection: normalizeProjection(params.get("projection")),
  });
}

export { activeFacetCount };
