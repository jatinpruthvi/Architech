import "server-only";

/* Executes the candidate narrowing from lib/search/sql.ts against Postgres.
 *
 * Guardrails baked into this file, matching how every other live source in
 * this repo activates:
 *  1. OFF BY DEFAULT — `ARCHITECH_SEARCH_SQL_NARROW=on` is required. Absent
 *     or anything else means the scoped bounded read + JS filter path runs,
 *     exactly as before.
 *  2. FAILS CLOSED AND LOUD — any SQL error (missing pg_trgm, missing
 *     searchVector because migrations have not been deployed, permission
 *     problems) is caught, logged as `search.sql_narrow_failed`, and the
 *     caller serves the ordinary JS path. Search never 500s because
 *     narrowing did.
 *  3. MEASURED — every executed narrow reports how large the candidate pool
 *     is, which is the telemetry that tells us the FTS indexes are real.
 */
import { getPrismaClient } from "@/lib/repositories/server/prisma";
import { logger } from "@/lib/observability/logger";
import { buildSqlNarrowPlan } from "./sql";

export function sqlNarrowEnabled(env: Partial<Record<string, string | undefined>> = process.env): boolean {
  return (env.ARCHITECH_SEARCH_SQL_NARROW ?? "").trim().toLowerCase() === "on";
}

export type NarrowOutcome =
  | { state: "not-required" }                 // no residual tokens: nothing for SQL to add
  | { state: "executed"; ids: string[]; candidates: number }
  | { state: "fallback"; reason: string };

/** Narrow the read to candidate listing ids, or explain why not. The generic
    client interface keeps this file unit-testable without a live database. */
type RawQueryable = { $queryRawUnsafe<T = unknown>(sql: string, ...params: string[]): Promise<T> };

export async function narrowListingIdsForQuery(
  query: string,
  client: RawQueryable = getPrismaClient() as unknown as RawQueryable,
): Promise<NarrowOutcome> {
  const plan = buildSqlNarrowPlan(query);
  if (!plan) return { state: "not-required" };
  try {
    const rows = await client.$queryRawUnsafe<Array<{ id: string }>>(plan.sql, ...plan.params);
    const ids = rows.map((row) => String((row as { id: unknown }).id)).filter((id) => id.length > 0);
    logger.info({ event: "search.sql_narrow_executed", tokens: plan.tokens.length, candidates: ids.length });
    return { state: "executed", ids, candidates: ids.length };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    logger.error({ event: "search.sql_narrow_failed", reason }, "SQL candidate narrowing failed; serving the bounded JS path");
    return { state: "fallback", reason };
  }
}
