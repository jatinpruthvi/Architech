import { queryResidualTokens, type SortId } from "@/lib/filters";

/* ---------- Text search configuration ----------
 *
 * `searchVector` is a UNION of two configurations (migration
 * 202609070001_search_text_config), so a query must be asked in both to see
 * both halves:
 *
 *   'english'          — stemmed, so "garden" finds "Thaltej Gardens".
 *   'architech_simple' — simple + unaccent, so "Do Talao" (english erases the
 *                        stopword "do"), "pāldi", and Devanagari titleHi/
 *                        descriptionHi are all findable.
 *
 * Measured on a live cluster: three queries that returned zero rows under
 * english-only now return the correct listing, with no regression on the
 * stemmed cases. Asking only one side would silently re-lose the other half.
 */
export const FTS_CONFIGS = ["architech_simple", "english"] as const;

/** `col @@ (websearch(simple,$n) || websearch(english,$n))` — one bound
    parameter, both configurations. Callers pass the placeholder (e.g. `$3`)
    so this composes with either parameter-numbering scheme in the repo. */
export function ftsMatchSql(column: string, placeholder: string): string {
  const alternatives = FTS_CONFIGS.map((config) => `websearch_to_tsquery('${config}', ${placeholder})`).join(" || ");
  return `${column} @@ (${alternatives})`;
}

export type SearchSqlPlan = {
  where: string[];
  orderBy: string;
  limit: number;
  usesFts: boolean;
  usesTrigram: boolean;
};

export function normalizeSearchTokens(query: string): string[] {
  return query
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[^\p{L}\p{M}\p{N}.]+/gu, " ")
    .split(/\s+/)
    .filter((token) => token.length > 1);
}

export function buildPostgresSearchPlan({ query = "", filters = [], sort = "fresh", limit = 24 }: { query?: string; filters?: string[]; sort?: SortId; limit?: number }): SearchSqlPlan {
  const where = ['"Listing"."lifecycle" = \'ACTIVE\''];
  const tokens = normalizeSearchTokens(query);

  if (tokens.length > 0) {
    where.push(ftsMatchSql('"Listing"."searchVector"', "$query"));
    where.push('("Listing"."title" % $query OR "Listing"."description" % $query OR "Listing"."addressLocality" % $query OR "Locality"."name" % $query)');
  }

  if (filters.includes("2bhk")) where.push('"Listing"."bhk" = 2');
  if (filters.includes("3bhk")) where.push('"Listing"."bhk" >= 3');
  if (filters.includes("under15")) where.push('"Listing"."priceInr" < 15000000');
  if (filters.includes("rera")) where.push('"Listing"."verification" = \'RERA_VERIFIED\'');

  const orderBy = sort === "price-asc"
    ? '"Listing"."priceInr" ASC'
    : sort === "price-desc"
      ? '"Listing"."priceInr" DESC'
      : '"Listing"."meaningfulUpdatedAt" DESC';

  return {
    where,
    orderBy,
    limit: Math.min(Math.max(limit, 1), 100),
    usesFts: tokens.length > 0,
    usesTrigram: tokens.length > 0,
  };
}

/* ---------- Executed narrowing (candidate selection) ----------
 *
 * The plan above describes the ideal filter. Executing it VERBATIM would
 * silently shrink recall: `matchesQuery` (lib/filters.ts) keeps a listing when
 * every residual token appears as a SUBSTRING anywhere in locality/title/city/
 * project/developer/subtype or fuzzy-matches a locality alias — whereas the
 * plan ANDs FTS with raw-string trigram similarity, dropping e.g. the
 * whitespace-less "prahladnagar" and any Devanagari title match.
 *
 * `buildSqlNarrowPlan` therefore builds the inverse guarantee: a candidate
 * predicate that is structurally a SUPERSET of the JS matcher for the same
 * query (same tokenizer — `queryResidualTokens` — and every haystack column
 * covered as an ILIKE alternative, plus FTS and trigram/alternate-name fuzz on
 * top). The server fetches the candidates and then runs the UNCHANGED JS
 * filter over them, so results are byte-for-byte what the in-memory path
 * returns today; the database read is just bounded by SQL instead of by the
 * 5000-row ceiling. `NARROW_HAYSTACK_COLUMNS` below is the machine-checkable
 * half of that guarantee (see sql-narrow tests).
 */

/** Every JS-haystack text source on the Listing relation graph, expressed as
    parameterised ILIKE targets. Every entry is exercised by name in the
    tests, so adding a haystack field in `matchesQuery` without adding it here
    breaks the build through the test suite, not through lost listings. */
export const NARROW_HAYSTACK_SQL_TARGETS = [
  'listing."title"',
  'listing."titleHi"',
  'listing."description"',
  'listing."descriptionHi"',
  'listing."note"',
  'listing."addressLocality"',
  'listing."propertyType"',
  'locality."name"',
  'city."name"',
] as const;

export type SqlNarrowPlan = {
  sql: string;
  params: string[];
  tokens: string[];
};

/* Exported so the page-query builder (sql-page.ts) escapes LIKE parameters
   with the exact same rules — one implementation, not two that can drift. */
export function escapeLike(value: string): string {
  /* Tokens cannot contain % _ or \ today (the splitter removes everything
     that is not a letter, mark or number) — escape anyway so the guarantee
     does not silently depend on the token regex staying that way. */
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/** Parameterised candidate WHERE fragment for one query, or null when the
    query carries no residual tokens (structured-only queries like "3 bhk
    under 1.5 cr" narrow through the price/bhk filters the JS layer applies,
    so the SQL path adds nothing and the scoped read stands). */
export function buildSqlNarrowPlan(rawQuery: string, citySlug?: string): SqlNarrowPlan | null {
  const tokens = queryResidualTokens(rawQuery);
  if (tokens.length === 0) return null;

  const params: string[] = [];

  /* City scope pushdown (QP-19-001).
   *
   * The caller's read is ALREADY city-scoped — searchListingsForServer passes
   * `citySlug` to getListingsForServer, which applies `city: { slug }` to the
   * same Listing table. Narrowing therefore returned candidate ids for every
   * city in the country and handed them to an `id: { in: [...] }` whose other
   * predicate discarded every out-of-city one anyway: the work was done twice
   * and the discarded half travelled over the wire as a literal id list.
   *
   * IDENTITY, not a heuristic: an id outside the scoped city cannot survive
   * the outer read, so removing it here cannot change a single returned row.
   * This is the one narrowing constraint that is safe to add — a LIMIT would
   * NOT be, because the candidate set is unordered and truncating it would
   * silently drop rows the JS filter would have kept (the superset guarantee
   * is what makes this whole path correct). Boundedness stays where it is
   * already honest: the outer read's ceiling.
   */
  const cityClause = citySlug ? `AND city."slug" = $${params.push(citySlug)}` : null;

  const tokenClauses = tokens.map((token) => {
    params.push(`%${escapeLike(token)}%`, token);
    const likeParam = params.length - 1;
    const rawParam = params.length;
    const likeAlternatives = NARROW_HAYSTACK_SQL_TARGETS.map((target) => `${target} ILIKE $${likeParam} ESCAPE '\\'`).join(" OR ");
    return [
      "(",
      `  ${likeAlternatives}`,
      `  OR ${ftsMatchSql('listing."searchVector"', `$${rawParam}`)}`,
      `  OR locality."name" % $${rawParam}`,
      `  OR city."name" % $${rawParam}`,
      /* QP-19-004: matched against the normalised LocalityAlias TABLE, not
         `unnest(locality."aliases")`. The array form could not use an index
         at all — unnest() is an opaque set-returning function to the planner,
         so neither the ILIKE nor the `%` could be served and every candidate
         search scanned the array per row. LocalityAlias."normalizedName" has
         a real trigram index (202609070003), and the join rides the leading
         column of the (localityId, normalizedName, languageCode) unique key.

         RECALL: this WIDENS, never narrows. LocalityAlias is a superset of
         the legacy array — migration 202608300002 backfilled it by
         `UNNEST(locality."aliases")` as type SEARCH, on top of the OFFICIAL
         name and TRANSLITERATION hindiName rows, and db/seed.mjs keeps
         writing both. Widening is safe here because this alternative is OR'd
         into a candidate SUPERSET that the unchanged JS filter then narrows,
         so the returned rows cannot change. */
      `  OR EXISTS (SELECT 1 FROM "LocalityAlias" AS alias WHERE alias."localityId" = locality."id" AND (alias."normalizedName" ILIKE $${likeParam} ESCAPE '\\' OR alias."normalizedName" % $${rawParam}))`,
      ")",
    ].join("\n");
  });

  const sql = [
    'SELECT listing."id" FROM "Listing" AS listing',
    'JOIN "Locality" AS locality ON locality."id" = listing."localityId"',
    'JOIN "City" AS city ON city."id" = listing."cityId"',
    `WHERE listing."lifecycle" = 'ACTIVE'`,
    ...(cityClause ? [cityClause] : []),
    ...tokenClauses.map((clause) => `AND ${clause}`),
  ].join("\n");

  return { sql, params, tokens };
}
