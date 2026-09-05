import { queryResidualTokens, type SortId } from "@/lib/filters";

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
    where.push('"Listing"."searchVector" @@ websearch_to_tsquery(\'english\', $query)');
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

function escapeLike(value: string): string {
  /* Tokens cannot contain % _ or \ today (the splitter removes everything
     that is not a letter, mark or number) — escape anyway so the guarantee
     does not silently depend on the token regex staying that way. */
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/** Parameterised candidate WHERE fragment for one query, or null when the
    query carries no residual tokens (structured-only queries like "3 bhk
    under 1.5 cr" narrow through the price/bhk filters the JS layer applies,
    so the SQL path adds nothing and the scoped read stands). */
export function buildSqlNarrowPlan(rawQuery: string): SqlNarrowPlan | null {
  const tokens = queryResidualTokens(rawQuery);
  if (tokens.length === 0) return null;

  const params: string[] = [];
  const tokenClauses = tokens.map((token) => {
    params.push(`%${escapeLike(token)}%`, token);
    const likeParam = params.length - 1;
    const rawParam = params.length;
    const likeAlternatives = NARROW_HAYSTACK_SQL_TARGETS.map((target) => `${target} ILIKE $${likeParam} ESCAPE '\\'`).join(" OR ");
    return [
      "(",
      `  ${likeAlternatives}`,
      `  OR listing."searchVector" @@ websearch_to_tsquery('english', $${rawParam})`,
      `  OR locality."name" % $${rawParam}`,
      `  OR city."name" % $${rawParam}`,
      `  OR EXISTS (SELECT 1 FROM unnest(locality."aliases") AS alias WHERE alias ILIKE $${likeParam} ESCAPE '\\' OR alias % $${rawParam})`,
      ")",
    ].join("\n");
  });

  const sql = [
    'SELECT listing."id" FROM "Listing" AS listing',
    'JOIN "Locality" AS locality ON locality."id" = listing."localityId"',
    'JOIN "City" AS city ON city."id" = listing."cityId"',
    `WHERE listing."lifecycle" = 'ACTIVE'`,
    ...tokenClauses.map((clause) => `AND ${clause}`),
  ].join("\n");

  return { sql, params, tokens };
}
