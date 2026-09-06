/* Full SQL page query for prisma-mode search (cost audit P0.1, final step).
 *
 * When ARCHITECH_SEARCH_SQL_PAGE=on, searchListingsForServer runs the page
 * query against Postgres instead of reading up to 5,000 rows and filtering in
 * JS: WHERE + ORDER BY + LIMIT/OFFSET for the page window, COUNT(*) for the
 * total, and one aggregation per facet group for the honest counts. Only the
 * page window (≤ 48 rows) is hydrated through the standard Prisma include +
 * mapper, so the row shape the UI sees is byte-for-byte the existing one.
 *
 * Recall identity — the guardrail this whole module exists to protect:
 *  1. Every predicate is either a direct column comparison with the SAME
 *     comparison semantics the JS path applies, or a slug/value SET that the
 *     runtime precomputes in JS with the EXACT fixture-registry functions the
 *     JS path uses (alias matching, PIN lookup, bbox containment all run over
 *     the in-memory registry in both modes — see lib/pincodes.ts, lib/map.ts,
 *     lib/search/aliases.ts). Nothing here is "approximately" the JS rule.
 *  2. Predicates that are NOT exactly reproducible in SQL decline the SQL
 *     path entirely (sqlPageDeclines): `furnishing` is declined whenever the
 *     group is PROJECTED (its facet counts need detailsJson with a prose
 *     fallback into sourceSummary even when nothing is selected — that is
 *     the desk surface; the consumer surface has no furnishing group), and
 *     an ACTIVE `fresh` selection is declined because recency is derived by
 *     parsing a human label the prisma mapper renders as an absolute date
 *     the parser never matches (the JS path is therefore always empty there)
 *     — we refuse to freeze that accident in SQL. A decline is a logged
 *     decision — the caller serves the JS path, which is correct by
 *     construction.
 *  3. The parity matrix in sql-page-integration.test.ts runs the JS path and
 *     the SQL path over the same database and asserts identical responses,
 *     which is what makes the port verifiable instead of trusted.
 *
 * Two-stage build: the plan is offset-independent EXCEPT the page-window
 * statement. The runtime must run `total` first, clamp the requested page
 * with the SAME safe-page rule as paginate(), then call pageStatement(offset)
 * — the offset cannot be known before the COUNT.
 */
import { AVAILABILITY_ALIASES, PROPERTY_TYPE_OPTIONS, AVAILABILITY_OPTIONS, type AvailabilityCode } from "@/lib/listing-vocabulary";
import { extractStructuredQuery, queryResidualTokens, type MarketCategory, type MarketIntent, type SortId } from "@/lib/filters";
import type { FacetGroup, FacetState } from "./facets";
import { escapeLike } from "./sql";

export type SqlStatement = { key: string; sql: string; params: unknown[] };

export type SqlPagePlan = {
  /** `total` + per-group pools + `pooledPlace` — every offset-independent
      statement, ready to run in parallel. */
  statements: SqlStatement[];
  /** Facet group id → key of its pool statement. */
  poolKeys: Record<string, string>;
  /** The page-window statement for an offset into the sorted result set. */
  pageStatement(offset: number): SqlStatement;
};

/** Alias match sets for one residual token. `names` are lowercase (compared
    against lower(locality."name")) — the JS matcher's name branch looks the
    token up by case-insensitive locality name, first registry entry wins,
    and the runtime reproduces that first-wins map exactly. */
export type TokenAliasMatch = { slugs: string[]; names: string[] };

export type SqlPageInput = {
  /** Trimmed query text ("" = none). */
  query: string;
  /** City scope, or undefined for nationwide. */
  citySlug?: string;
  /** Locality slugs serving the ?pincode= param, via the same registry
      lookup listingMatchesPincode performs. ABSENT = no PIN param; present
      but EMPTY = a well-formed PIN the registry links to no locality — the
      JS path resolves that to an EMPTY result, not "no constraint". */
  pinParamSlugs?: string[];
  /** Same for the PIN extracted from the query text. */
  queryPinSlugs?: string[];
  /** (localitySlug, citySlug) pairs whose reviewed marker lies inside the
      ?bbox= rectangle (fixture registry via the same listingWithinBounds the
      JS path calls). ABSENT = no bbox param; present but EMPTY = a viewport
      no reviewed marker falls in → the JS path returns empty. */
  bboxPairs?: Array<[string, string]>;
  /** Alias match sets per residual token (fixture registry via the same
      localityMatchesToken / localityNameMatchesToken the JS matcher calls).
      Tokens are the exact queryResidualTokens output. */
  tokenAliasMatches?: ReadonlyMap<string, TokenAliasMatch>;
  /** The place facet's selected localities, INTERSECTED with the localities
      present in the pre-facet pool (the runtime derives the intersection
      from the pooledPlace statement). The JS predicate resolves selected
      ids against the pool-derived option list, so a selected locality with
      no matching inventory constrains NOTHING — an empty intersection must
      produce no predicate, never an empty IN(). */
  placeSlugs?: string[];
  category: MarketCategory;
  intent: MarketIntent;
  state: FacetState;
  /** The projection-resolved groups — counts are computed for exactly these. */
  groups: FacetGroup[];
  sort: SortId;
  /** Normalized page size. */
  pageSize: number;
};

/* ---------- Portability ---------- */

/** Active predicates the SQL path cannot reproduce EXACTLY. Empty = portable.
    A decline is a logged decision, never a silent degradation: the caller
    serves the JS path (which is always correct by construction). */
export function sqlPageDeclines(state: FacetState, groups: FacetGroup[]): string[] {
  const reasons: string[] = [];
  for (const group of groups) {
    const selected = state.multi[group.id] ?? [];
    if (group.id === "fresh") {
      // Only the ACTIVE predicate is non-derivable. The inactive count is a
      // frozen constant (0) in prisma mode because the mapper's absolute-date
      // label never matches the parser — pinned by the parity matrix, which
      // fails if the label format ever changes.
      if (!selected.length) continue;
      reasons.push(
        "fresh:recency is derived by parsing the human status label; the prisma mapper renders an absolute date the parser never matches (the JS path is therefore always empty there) and freezing that accident in SQL would silently break recall if the label format ever changes",
      );
    }
    if (group.id === "furnishing") {
      // Declined whenever the group is PROJECTED, not just selected: the facet
      // counts need detailsJson (with a prose fallback into sourceSummary)
      // even when nothing is selected. That is the desk surface — the
      // consumer surface has no furnishing group and keeps the page path.
      reasons.push(
        "furnishing:the JS predicate reads details.furnishing, which falls back to a prose scrape of the DB column sourceSummary for rows without detailsJson — not reproducible in SQL",
      );
    }
  }
  return reasons;
}

/* ---------- Predicate construction ---------- */

const FROM = [
  '"Listing" AS listing',
  'JOIN "Locality" AS locality ON locality."id" = listing."localityId"',
  'JOIN "City" AS city ON city."id" = listing."cityId"',
].join(" ");

/* The mapper derives `subtype` from propertyType exactly this way
   (VILLA→"Villa", PLOT→"Plot", else "Flat/Apartment") — the free-text
   haystack includes it, so the SQL token predicate must too. */
const SUBTYPE_CASE =
  'CASE WHEN listing."propertyType" = \'VILLA\' THEN \'Villa\' WHEN listing."propertyType" = \'PLOT\' THEN \'Plot\' ELSE \'Flat/Apartment\' END';

/* normalizeAvailability (listing-vocabulary.ts) expressed in SQL: a stored
   code passes through, a legacy label maps through the exported alias table,
   and anything else (including NULL) resolves to the mapper default. */
const AVAILABILITY_PRED = (() => {
  const codes = AVAILABILITY_OPTIONS.map((option) => option.value);
  const lines = [`WHEN listing."availability" IN (${codes.map((code) => `'${code}'`).join(", ")}) THEN listing."availability"`];
  for (const [alias, code] of Object.entries(AVAILABILITY_ALIASES)) {
    lines.push(`WHEN lower(btrim(listing."availability")) = '${alias}' THEN '${code}'`);
  }
  return `COALESCE(CASE ${lines.join(" ")} ELSE NULL END, 'READY_TO_MOVE')`;
})();

/* Fixed option vocabulary → exact column predicates. An option id that is
   not in the table constrains NOTHING, exactly like the JS path (a selected
   id with no resolvable value "constrains nothing" — lib/search/facets.ts). */
const BHK_PREDICATES: Record<string, string> = {
  "1": 'listing."bhk" = 1',
  "2": 'listing."bhk" = 2',
  "3": 'listing."bhk" = 3',
  "4": 'listing."bhk" = 4',
  "5+": 'listing."bhk" >= 5',
};
const TYPE_BY_SLUG: Record<string, string> = Object.fromEntries(PROPERTY_TYPE_OPTIONS.map((option) => [option.slug, option.value]));
const STATUS_BY_ID: Record<string, AvailabilityCode> = Object.fromEntries(AVAILABILITY_OPTIONS.map((option) => [option.value.toLowerCase(), option.value]));

type Ctx = { params: unknown[] };
const pushParam = (ctx: Ctx, value: unknown): string => {
  ctx.params.push(value);
  return `$${ctx.params.length}`;
};
const inList = (ctx: Ctx, column: string, values: string[]): string =>
  values.length ? `${column} IN (${values.map((value) => pushParam(ctx, value)).join(", ")})` : "(1=0)";

/** The facet predicate for one group, or null when the group contributes
    nothing (inactive, or only unresolvable values selected). */
function groupPredicate(group: FacetGroup, state: FacetState, input: SqlPageInput, ctx: Ctx): string | null {
  if (group.kind === "range") {
    const range = state.ranges[group.id];
    if (!range || !group.range) return null;
    if (group.id === "price") {
      return `listing."priceInr" >= ${pushParam(ctx, range.from)} AND listing."priceInr" <= ${pushParam(ctx, range.to)}`;
    }
    if (group.id === "area") {
      const from = pushParam(ctx, range.from);
      const to = pushParam(ctx, range.to);
      return `COALESCE(listing."areaSqft", 0) >= ${from} AND COALESCE(listing."areaSqft", 0) <= ${to}`;
    }
    return null;
  }
  const selected = state.multi[group.id] ?? [];
  if (!selected.length) return null;
  switch (group.id) {
    case "place":
      // See SqlPageInput.placeSlugs: an empty intersection is "no predicate",
      // which is what the JS path does when a selected locality has no
      // matching inventory in the pool.
      return input.placeSlugs?.length ? inList(ctx, 'locality."slug"', input.placeSlugs) : null;
    case "bhk": {
      const ors = selected.map((id) => BHK_PREDICATES[id]).filter(Boolean);
      return ors.length ? ors.join(" OR ") : null;
    }
    case "type": {
      const codes = selected.map((id) => TYPE_BY_SLUG[id]).filter(Boolean);
      return codes.length ? inList(ctx, 'listing."propertyType"', codes) : null;
    }
    case "status": {
      const codes = selected.map((id) => STATUS_BY_ID[id]).filter(Boolean);
      return codes.length ? `${AVAILABILITY_PRED} IN (${codes.map((code) => `'${code}'`).join(", ")})` : null;
    }
    case "media": {
      // The prisma read carries exactly ONE media row (take: 1 in
      // repositories/server/prisma.ts): the mapper's `image` therefore never
      // sees an empty list (it defaults to "locality-street") and `gallery`
      // is always []. So has-photos matches everything and multi-photo
      // matches nothing — reproduced EXACTLY here rather than "improved"
      // (fixing take: 1 is a product decision, not a search-path one).
      const ids = new Set(selected);
      if (ids.has("has-photos")) return "(1=1)";
      if (ids.has("multi-photo")) return "(1=0)";
      return null;
    }
    case "trust":
      // parseFacetState normalises an active toggle to the group's first
      // value ("rera"), so an active trust state is exactly this predicate.
      return selected.every((id) => id === "rera") ? 'listing."verification" = \'RERA_VERIFIED\'' : null;
    default:
      return null; // fresh/furnishing are declined upstream; unknown groups constrain nothing
  }
}

/** The single-option predicate used for per-option conditional counts. */
function optionPredicate(group: FacetGroup, optionId: string): string | null {
  switch (group.id) {
    case "bhk":
      return BHK_PREDICATES[optionId] ?? null;
    case "type": {
      const code = TYPE_BY_SLUG[optionId];
      return code ? `listing."propertyType" = '${code}'` : null;
    }
    case "status": {
      const code = STATUS_BY_ID[optionId];
      return code ? `${AVAILABILITY_PRED} = '${code}'` : null;
    }
    case "media":
      return optionId === "has-photos" ? "(1=1)" : optionId === "multi-photo" ? "(1=0)" : null;
    case "trust":
      return optionId === "rera" ? 'listing."verification" = \'RERA_VERIFIED\'' : null;
    case "fresh":
      // The frozen-0 count: the prisma mapper's absolute-date label never
      // matches the recency parser, so the JS path's count is 0 too. Pinned
      // by the parity matrix (it fails if the label format ever changes).
      return null;
    case "furnishing":
      // Unreachable: sqlPageDeclines declines the page path whenever the
      // furnishing group is projected, so a plan never includes it.
      return null;
    default:
      return null;
  }
}

type Pred = { group: string | null; sql: string };

/** All predicates for one statement, against the caller's parameter context.
    `excludeGroup` drops one facet group's predicate (the "count with this
    group removed" pool); "__no-facets__" drops every facet predicate (the
    pre-facet pool the place-predicate resolution and the widening
    candidates are derived from). */
function buildPredicates(input: SqlPageInput, excludeGroup: string | null, ctx: Ctx): Pred[] {
  const preds: Pred[] = [{ group: null, sql: 'listing."lifecycle" = \'ACTIVE\'' }];

  if (input.citySlug) preds.push({ group: null, sql: `city."slug" = ${pushParam(ctx, input.citySlug)}` });
  if (input.pinParamSlugs !== undefined) {
    preds.push({ group: null, sql: input.pinParamSlugs.length ? inList(ctx, 'locality."slug"', input.pinParamSlugs) : "(1=0)" });
  }
  if (input.bboxPairs !== undefined) {
    if (input.bboxPairs.length) {
      const rows = input.bboxPairs.map(([slug, city]) => `(${pushParam(ctx, slug)},${pushParam(ctx, city)})`);
      preds.push({ group: null, sql: `(locality."slug", city."slug") IN (${rows.join(",")})` });
    } else {
      preds.push({ group: null, sql: "(1=0)" });
    }
  }

  const query = input.query.trim();
  if (query) {
    const structured = extractStructuredQuery(query);
    if (input.queryPinSlugs !== undefined) preds.push({ group: null, sql: inList(ctx, 'locality."slug"', input.queryPinSlugs) });
    if (structured.bhk !== null) preds.push({ group: null, sql: `listing."bhk" = ${pushParam(ctx, structured.bhk)}` });
    if (structured.underLimit !== null) preds.push({ group: null, sql: `listing."priceInr" < ${pushParam(ctx, structured.underLimit)}` });

    /* Same tokenizer the JS matcher uses (queryResidualTokens — the function
       matchesQuery itself calls). The haystack the JS matcher lowercases and
       substring-scans is: locality name, title, city name, project, developer,
       subtype — but the Listing table has NO projectName/developerName
       columns, so the mapper's fallbacks are constants: project is ALWAYS
       `title` (deduped below — a repeated field cannot change a substring
       test) and developer is ALWAYS the literal "Verified partner".
       addressLocality is intentionally NOT here: the JS matcher never reads
       that column. The JS joins the fields with spaces, and tokens never
       contain spaces, so per-field ILIKE OR'd is exactly the joined-haystack
       substring test. */
    for (const token of queryResidualTokens(query)) {
      const like = pushParam(ctx, `%${escapeLike(token)}%`);
      const esc = " ESCAPE '\\'";
      const parts = [
        `listing."title" ILIKE ${like}${esc}`,
        `locality."name" ILIKE ${like}${esc}`,
        `city."name" ILIKE ${like}${esc}`,
        `'Verified partner' ILIKE ${like}${esc}`,
        `(${SUBTYPE_CASE}) ILIKE ${like}${esc}`,
      ];
      const alias = input.tokenAliasMatches?.get(token);
      const aliasParts: string[] = [];
      if (alias) {
        if (alias.slugs.length) aliasParts.push(inList(ctx, 'locality."slug"', alias.slugs));
        if (alias.names.length) aliasParts.push(`lower(locality."name") IN (${alias.names.map((name) => pushParam(ctx, name)).join(", ")})`);
      }
      if (aliasParts.length) parts.push(`(${aliasParts.join(" OR ")})`);
      preds.push({ group: null, sql: `(${parts.join(" OR ")})` });
    }
  }

  /* The Listing table has no `category` / `transactionType` columns, so the
     mapper sees neither: property.category is ALWAYS "residential" and
     transaction ALWAYS "buy" in prisma mode. A commercial/pg/plot/land/auction
     category or a rent intent therefore matches NOTHING today — reproduced
     exactly, and this is where the column predicates go when the schema
     gains the fields. */
  if (input.category !== "all" && input.category !== "residential") preds.push({ group: null, sql: "(1=0)" });
  if (input.intent === "rent") preds.push({ group: null, sql: "(1=0)" });

  for (const group of input.groups) {
    if (excludeGroup === "__no-facets__" || excludeGroup === group.id) continue;
    const sql = groupPredicate(group, input.state, input, ctx);
    if (sql) preds.push({ group: group.id, sql });
  }
  return preds;
}

const whereOf = (preds: Pred[]): string => preds.map((pred) => pred.sql).join(" AND ");

function orderByFor(sort: SortId): string {
  /* Mirrors applySort() over the prisma read order (meaningfulUpdatedAt
     desc; the id tie-break makes the window deterministic where the read's
     tie order was not, and matches the JS stable sort's tie behaviour on
     the seeded data). Price sorts keep the read order for equal prices,
     mirroring Array.prototype.sort's stability. */
  if (sort === "price-asc") return 'listing."priceInr" ASC, listing."meaningfulUpdatedAt" DESC, listing."id" ASC';
  if (sort === "price-desc") return 'listing."priceInr" DESC, listing."meaningfulUpdatedAt" DESC, listing."id" ASC';
  return 'listing."meaningfulUpdatedAt" DESC, listing."id" ASC';
}

/* ---------- Plan ---------- */

/** Build every offset-independent statement the page path executes, or null
    when an active predicate is not exactly portable (the caller declines and
    logs). The page window is built afterwards, once the runtime has the
    total and can clamp the page (pageStatement). */
export function buildSqlPagePlan(input: SqlPageInput): SqlPagePlan | null {
  if (sqlPageDeclines(input.state, input.groups).length > 0) return null;

  const statements: SqlStatement[] = [];
  const poolKeys: Record<string, string> = {};
  const build = (excludeGroup: string | null): { sql: string; params: unknown[] } => {
    const ctx: Ctx = { params: [] };
    const preds = buildPredicates(input, excludeGroup, ctx);
    return { sql: whereOf(preds), params: ctx.params };
  };
  const select = (key: string, excludeGroup: string | null, columns: string, tail = "") => {
    const built = build(excludeGroup);
    statements.push({ key, sql: `SELECT ${columns} FROM ${FROM} WHERE ${built.sql}${tail}`, params: built.params });
  };

  select("total", null, 'COUNT(*)::int AS n');

  for (const group of input.groups) {
    const key = `pool:${group.id}`;
    poolKeys[group.id] = key;
    if (group.kind === "range") {
      const columns = group.id === "price" ? 'listing."priceInr"::text AS value' : 'COALESCE(listing."areaSqft", 0) AS value';
      select(key, group.id, columns);
      continue;
    }
    if (group.derive === "localities") {
      select(key, group.id, 'locality."slug" AS slug, MAX(locality."name") AS name, COUNT(*)::int AS n', " GROUP BY locality.\"slug\"");
      continue;
    }
    const options = group.values ?? [];
    const counts = options
      .map((option, index) => {
        const pred = optionPredicate(group, option.id);
        return pred ? `COUNT(*) FILTER (WHERE ${pred})::int AS "c${index}"` : `0::int AS "c${index}"`;
      })
      .join(", ");
    select(key, group.id, `COUNT(*)::int AS pool${counts ? `, ${counts}` : ""}`);
  }
  /* Pre-facet pool: place-predicate resolution (selected ∩ present) and the
     widening candidate list are both derived from it, mirroring the JS
     path, which resolves both against the pre-facet `pooled` list. */
  select("pooledPlace", "__no-facets__", 'locality."slug" AS slug, MAX(locality."name") AS name, COUNT(*)::int AS n', " GROUP BY locality.\"slug\"");

  const pageStatement = (offset: number): SqlStatement => {
    const built = build(null);
    const limitParam = built.params.push(input.pageSize);
    const offsetParam = built.params.push(offset);
    return {
      key: "page",
      sql: `SELECT listing."id" AS id FROM ${FROM} WHERE ${built.sql} ORDER BY ${orderByFor(input.sort)} LIMIT $${limitParam} OFFSET $${offsetParam}`,
      params: built.params,
    };
  };

  return { statements, poolKeys, pageStatement };
}
