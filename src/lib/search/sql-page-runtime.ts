import "server-only";
import { localities, type Locality } from "@/lib/localities";
import { getLocalities } from "@/lib/repositories/localities";
import { localitiesForPincode } from "@/lib/pincodes";
import { boundsContainPoint, parseMarker, type MapBounds } from "@/lib/map";
import { localityMatchesToken } from "@/lib/search/aliases";
import { extractStructuredQuery, queryResidualTokens, type MarketCategory, type MarketIntent, type SortId } from "@/lib/filters";
import { logger } from "@/lib/observability/logger";
import { getPrismaClient, listingInclude } from "@/lib/repositories/server/prisma";
import { dbListingToProperty, type DbListingRow } from "@/lib/repositories/mappers";
import type { Property } from "@/lib/repositories";
import { buildHistogram, isFacetStateEmpty, type DerivedFacetValue, type FacetCounts, type FacetGroup, type FacetState, type Relaxation } from "./facets";
import { finalizeSearch } from "./search";
import type { FacetProjection, SearchResponse } from "./search-types";
import { buildSqlPagePlan, sqlPageDeclines, type SqlPageInput, type SqlPagePlan, type TokenAliasMatch } from "./sql-page";

/** ARCHITECH_SEARCH_SQL_PAGE=on → the page window, total, and facet counts
    run as SQL (this module); anything else (flag off, declined predicate,
    any failure) falls through to the JS path loudly. See sql-page.ts. */
export function sqlPageEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return (env.ARCHITECH_SEARCH_SQL_PAGE ?? "").trim().toLowerCase() === "on";
}

export type SqlPageRequest = {
  /** Trimmed query text. */
  query: string;
  /** Resolved city echo for the response ("all" when nationwide). */
  city: string;
  /** City scope for the read, or undefined for nationwide. */
  citySlug?: string;
  /** Parsed ?pincode= (null = none/malformed). */
  pincode: string | null;
  /** Parsed ?bbox= (null = none). */
  bounds: MapBounds | null;
  groups: FacetGroup[];
  state: FacetState;
  sort: SortId;
  /** Normalized page (≥ 1) and page size. */
  page: number;
  pageSize: number;
  category: MarketCategory;
  intent: MarketIntent;
  projection: FacetProjection;
};

/* ---------- Fixture-registry precomputation (the JS rules, verbatim) ---------- */

/** The (slug, citySlug) pairs whose reviewed marker lies in the viewport —
    exactly the localities listingWithinBounds would accept (it looks each
    listing's locality up in this same registry per request; doing it once
    per request is the same test applied in bulk). */
function buildBboxPairs(bounds: MapBounds): Array<[string, string]> {
  const pairs: Array<[string, string]> = [];
  for (const locality of getLocalities()) {
    const coords = parseMarker(locality.marker);
    if (coords && boundsContainPoint(bounds, coords)) pairs.push([locality.slug, locality.citySlug]);
  }
  return pairs;
}

/** Alias match sets per token, reproducing BOTH branches of the JS matcher's
    locality test: localityMatchesToken(listingSlug, token) OR
    localityNameMatchesToken(localityName, token) — the name branch finds the
    FIRST registry entry whose name matches (case-insensitively) and aliases
    that entry's slug, so the name set is built from the same first-wins map. */
function buildTokenAliasMatches(tokens: string[]): ReadonlyMap<string, TokenAliasMatch> | undefined {
  if (!tokens.length) return undefined;
  const firstEntryByLowerName = new Map<string, Locality>();
  for (const locality of localities) {
    const key = locality.name.toLowerCase();
    if (!firstEntryByLowerName.has(key)) firstEntryByLowerName.set(key, locality);
  }
  const out = new Map<string, TokenAliasMatch>();
  for (const token of tokens) {
    const slugs: string[] = [];
    for (const locality of localities) if (localityMatchesToken(locality.slug, token)) slugs.push(locality.slug);
    const names: string[] = [];
    for (const locality of firstEntryByLowerName.values()) {
      if (localityMatchesToken(locality.slug, token)) names.push(locality.name.toLowerCase());
    }
    out.set(token, { slugs, names });
  }
  return out;
}

/* ---------- Row shapes the statements return ---------- */

/** `executed` carries the response; `declined` means an active predicate is
    not exactly portable (the JS path is the designed one for it); `failed`
    means the SQL threw and the JS path is a logged fallback. */
export type SqlPageOutcome = { state: "executed"; response: SearchResponse } | { state: "declined" } | { state: "failed" };

type CountRow = { n: number };
type PoolRow = Record<string, number | string>;
type PlaceRow = { slug: string; name: string; n: number };
type IdRow = { id: string };

type RawQueryable = { $queryRawUnsafe<T>(sql: string, ...params: unknown[]): Promise<T> };

const runStatement = async <T>(statement: { key: string; sql: string; params: unknown[] }): Promise<T> => {
  const client = getPrismaClient() as unknown as RawQueryable;
  return client.$queryRawUnsafe<T>(statement.sql, ...statement.params);
};

/* ---------- Execution ---------- */

/** Run the full page query in SQL. `declined` (an active predicate is not
    exactly portable) and `failed` (the SQL threw) both mean the caller serves
    the JS path; the two are labelled differently in `indexPlan` because a
    failure is a degradation that must be visible. Never throws. */
export async function executeSqlPageSearch(request: SqlPageRequest): Promise<SqlPageOutcome> {
  const declines = sqlPageDeclines(request.state, request.groups);
  if (declines.length) {
    logger.info({ event: "search.sql_page_declined", reasons: declines, city: request.city });
    return { state: "declined" };
  }

  const structured = request.query ? extractStructuredQuery(request.query) : null;
  const tokens = request.query ? queryResidualTokens(request.query) : [];

  const input: SqlPageInput = {
    query: request.query,
    citySlug: request.citySlug,
    pinParamSlugs: request.pincode ? localitiesForPincode(request.pincode).map((locality) => locality.slug) : undefined,
    queryPinSlugs: structured?.pincode ? localitiesForPincode(structured.pincode).map((locality) => locality.slug) : undefined,
    bboxPairs: request.bounds ? buildBboxPairs(request.bounds) : undefined,
    tokenAliasMatches: tokens.length ? buildTokenAliasMatches(tokens) : undefined,
    /* Place is resolved after the pooledPlace read (see below). */
    placeSlugs: [],
    category: request.category,
    intent: request.intent,
    state: request.state,
    groups: request.groups,
    sort: request.sort,
    pageSize: request.pageSize,
  };

  try {
    /* Stage 1: the pre-facet pool, to resolve the place predicate the way the
       JS path does (selected ∩ localities present in the pool; an empty
       intersection must constrain nothing). pooledPlace carries no facet
       predicate, so it is identical in both plan builds. */
    let plan = buildSqlPagePlan(input);
    if (!plan) return { state: "declined" };
    const pooledPlace = plan.statements.find((statement) => statement.key === "pooledPlace");
    if (!pooledPlace) throw new Error("SQL page plan is missing the pooledPlace statement");
    const pooledRows = await runStatement<PlaceRow[]>(pooledPlace);
    const pooledSlugs = new Set(pooledRows.map((row) => row.slug));
    input.placeSlugs = (request.state.multi.place ?? []).filter((slug) => pooledSlugs.has(slug));

    /* Stage 2: the real plan with the resolved place predicate. */
    plan = buildSqlPagePlan(input);
    if (!plan) return { state: "declined" };

    const rest = plan.statements.filter((statement) => statement.key !== "pooledPlace");
    const results = await Promise.all(rest.map(async (statement) => ({ key: statement.key, rows: (await runStatement<PoolRow[]>(statement)) as PoolRow[] })));
    const byKey = new Map(results.map((result) => [result.key, result.rows]));
    const total = Number((byKey.get("total")?.[0] as CountRow | undefined)?.n ?? 0);

    /* Same safe-page clamp paginate() applies to the JS path's list. */
    const totalPages = Math.max(1, Math.ceil(total / request.pageSize));
    const safePage = Math.min(request.page, totalPages);
    const pageRows = await runStatement<IdRow[]>(plan.pageStatement((safePage - 1) * request.pageSize));
    const pageIds = pageRows.map((row) => row.id);

    /* Rehydrate ONLY the page window through the standard read + mapper, so
       the row shape is identical to every other listing read. */
    const items = await rehydrateItems(pageIds);

    /* Facets from the pool statements — same pool, same option predicates,
       same histogram builder the JS path uses. */
    const facets = assembleFacets(request.groups, request.state, plan, byKey);

    const meta = {
      page: safePage,
      pageSize: request.pageSize,
      total,
      totalPages,
      hasNextPage: safePage < totalPages,
      hasPreviousPage: safePage > 1,
    };

    const empty = total === 0 && !isFacetStateEmpty(request.state);
    const relaxations = empty ? assembleRelaxations(request.groups, request.state, plan, byKey) : [];
    const widening = empty ? assembleWidening(request.groups, request.state, pooledRows, plan, byKey) : [];

    return {
      state: "executed",
      response: finalizeSearch({
        query: request.query,
        city: request.city,
        pincode: request.pincode,
        state: request.state,
        groups: request.groups,
        projection: request.projection,
        category: request.category,
        intent: request.intent,
        sort: request.sort,
        count: total,
        meta,
        items,
        pooled: [],
        source: "postgres-fts-trigram",
        indexPlan: "postgres-fts-trigram-page",
        precomputed: { facets, relaxations, widening },
      }),
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    logger.error({ event: "search.sql_page_failed", reason, city: request.city }, "SQL page query failed; serving the JS path");
    return { state: "failed" };
  }
}

/* ---------- Assembly (row → response) ---------- */

function assembleFacets(groups: FacetGroup[], state: FacetState, plan: SqlPagePlan, byKey: Map<string, PoolRow[]>): FacetCounts {
  const counts: FacetCounts = {};
  for (const group of groups) {
    const rows = byKey.get(plan.poolKeys[group.id]) ?? [];
    const selected = state.multi[group.id] ?? [];
    if (group.kind === "range" && group.range) {
      const values = rows.map((row) => Number(row.value));
      counts[group.id] = {
        id: group.id,
        label: group.label,
        labelHi: group.labelHi,
        kind: group.kind,
        histogram: buildHistogram(values, group.range),
        total: rows.length,
        options: [],
      };
      continue;
    }
    if (group.derive === "localities") {
      const placeRows = rows as unknown as PlaceRow[];
      counts[group.id] = {
        id: group.id,
        label: group.label,
        labelHi: group.labelHi,
        kind: group.kind,
        total: placeRows.reduce((sum, row) => sum + row.n, 0),
        options: [...placeRows]
          .sort((a, b) => b.n - a.n || a.name.localeCompare(b.name))
          .map((row) => ({ id: row.slug, label: row.name, count: row.n, selected: selected.includes(row.slug) })),
      };
      continue;
    }
    const row = rows[0] as PoolRow | undefined;
    const options = (group.values ?? []).map((value, index) => ({
      id: value.id,
      label: value.label,
      count: Number(row?.[`c${index}`] ?? 0),
      selected: selected.includes(value.id),
    }));
    counts[group.id] = { id: group.id, label: group.label, labelHi: group.labelHi, kind: group.kind, total: Number(row?.pool ?? 0), options };
  }
  return counts;
}

const poolTotalOf = (group: FacetGroup, plan: SqlPagePlan, byKey: Map<string, PoolRow[]>): number => {
  const rows = byKey.get(plan.poolKeys[group.id]) ?? [];
  if (group.kind === "range") return rows.length;
  if (group.derive === "localities") return (rows as unknown as PlaceRow[]).reduce((sum, row) => sum + row.n, 0);
  return Number((rows[0] as PoolRow | undefined)?.pool ?? 0);
};

/** Zero-result rung: removing each ACTIVE group gains its pool size (the
    baseline is 0 by construction), same labels, same cap, same order. */
function assembleRelaxations(groups: FacetGroup[], state: FacetState, plan: SqlPagePlan, byKey: Map<string, PoolRow[]>): Relaxation[] {
  const relaxations: Relaxation[] = [];
  for (const group of groups) {
    if (group.kind === "range") {
      if (!state.ranges[group.id]) continue;
      const next = { multi: state.multi, ranges: { ...state.ranges } };
      delete next.ranges[group.id];
      relaxations.push({ groupId: group.id, groupLabel: group.label, label: `Remove ${group.label.toLowerCase()}`, gain: poolTotalOf(group, plan, byKey), state: next });
      continue;
    }
    const selected = state.multi[group.id];
    if (!selected?.length) continue;
    const next = { multi: { ...state.multi }, ranges: state.ranges };
    delete next.multi[group.id];
    relaxations.push({
      groupId: group.id,
      groupLabel: group.label,
      label: `Remove ${group.label.toLowerCase()} (${selected.length})`,
      gain: poolTotalOf(group, plan, byKey),
      state: next,
    });
  }
  return relaxations.filter((relaxation) => relaxation.gain > 0).sort((a, b) => b.gain - a.gain).slice(0, 3);
}

/** Zero-result rung: localities the pre-facet pool knows, outside the active
    place selection, ordered by (count-with-place-swapped-in, pool volume,
    name) — exactly the JS ladder's stable sort over its derived order. */
function assembleWidening(
  groups: FacetGroup[],
  state: FacetState,
  pooledRows: PlaceRow[],
  plan: SqlPagePlan,
  byKey: Map<string, PoolRow[]>,
): DerivedFacetValue[] {
  const placeGroup = groups.find((group) => group.id === "place");
  if (!placeGroup) return [];
  const placeRows = (byKey.get(plan.poolKeys["place"]) ?? []) as unknown as PlaceRow[];
  const placeCounts = new Map(placeRows.map((row) => [row.slug, row.n]));
  const active = state.multi.place ?? [];
  return pooledRows
    .filter((row) => !active.includes(row.slug))
    .map((row) => ({ id: row.slug, label: row.name, count: placeCounts.get(row.slug) ?? 0, poolVolume: row.n }))
    .filter((candidate) => candidate.count > 0)
    .sort((a, b) => b.count - a.count || b.poolVolume - a.poolVolume || a.label.localeCompare(b.label))
    .slice(0, 3)
    .map((candidate) => ({
      id: candidate.id,
      label: candidate.label,
      count: candidate.count,
      match: (property: Property) => property.localitySlug === candidate.id,
    }));
}

/* ---------- Page-window rehydration ---------- */

async function rehydrateItems(ids: string[]): Promise<Property[]> {
  if (!ids.length) return [];
  const client = getPrismaClient();
  /* The page statement ordered by Prisma row id (deterministic window key);
     the mapper's public id is stableId||slug, so the rehydration map keeps
     the row id alongside the DbListingRow shape. */
  /* sql-perf: intentionally-unbounded — rehydration of exactly one result
     page (ids come from the already-windowed page statement), so the read
     size is the page window, not the table. */
  const rows = (await client.listing.findMany({ where: { id: { in: ids } }, include: listingInclude })) as unknown as Array<DbListingRow & { id: string }>;
  const byId = new Map(rows.map((row) => [row.id, row]));
  return ids
    .map((id) => byId.get(id))
    .filter((row): row is DbListingRow & { id: string } => Boolean(row))
    .map(dbListingToProperty);
}
