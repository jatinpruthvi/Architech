import type { SortId } from "@/lib/filters";

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
