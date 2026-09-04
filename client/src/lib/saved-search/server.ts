import "server-only";
import { createSavedSearch, dedupeKeyForSavedSearch, deleteSavedSearch, listSavedSearches, validateSavedSearchInput, type SavedSearchInput, type SavedSearchResult, type SavedSearchState } from "./saved-search";
import { isPrismaSavedSearchStorage } from "./source";
import { getPrismaClient } from "@/lib/repositories/server/prisma";

type PrismaSavedSearchClient = ReturnType<typeof getPrismaClient> & {
  savedSearch: { create(args: unknown): Promise<unknown>; findFirst(args: unknown): Promise<unknown | null>; findMany(args: unknown): Promise<Array<Record<string, unknown>>>; deleteMany(args: unknown): Promise<{ count: number }> };
};

const prisma = () => getPrismaClient() as unknown as PrismaSavedSearchClient;

function safeIso(value: unknown): string {
  const date = value instanceof Date ? value : new Date(String(value ?? ""));
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function rowToContract(row: Record<string, unknown>): SavedSearchState {
  return {
    id: String(row.id ?? ""),
    userId: typeof row.userId === "string" ? row.userId : null,
    query: String(row.query ?? ""),
    filters: Array.isArray(row.filters) ? (row.filters as string[]) : [],
    sort: typeof row.sort === "string" ? row.sort : null,
    notify: Boolean(row.notify),
    createdAt: safeIso(row.createdAt),
    updatedAt: safeIso(row.updatedAt),
  };
}

export async function createSavedSearchForServer(input: SavedSearchInput): Promise<SavedSearchResult> {
  if (!isPrismaSavedSearchStorage()) return createSavedSearch(input);
  /* B-7: the Prisma path previously skipped validation entirely, so an empty
     query+filters pair was stored. Same rules as the memory path. */
  const errors = validateSavedSearchInput(input);
  if (errors.length) return { ok: false, status: 400, errors };

  const db = prisma();
  const query = input.query?.trim() ?? "";
  const filters = (input.filters ?? []).map((f) => f.trim()).filter(Boolean);
  const sort = input.sort ?? null;
  const dedupeKey = dedupeKeyForSavedSearch({ query, filters, sort, userId: input.userId });

  /* Dedupe via the persisted key so a repeat save returns the existing row as
     a duplicate instead of stacking rows the user has to clean up. */
  const existing = (await db.savedSearch.findFirst({ where: { dedupeKey } })) as Record<string, unknown> | null;
  if (existing) {
    return { ok: true, savedSearch: rowToContract(existing), duplicate: true };
  }

  const created = (await db.savedSearch.create({
    data: {
      userId: input.userId ?? null,
      query,
      filters,
      sort,
      notify: input.notify ?? false,
      dedupeKey,
    },
  })) as Record<string, unknown>;
  return { ok: true, savedSearch: rowToContract(created), duplicate: false };
}

/* One account's saved searches.
 *
 * The `userId` filter is applied in the QUERY, not after the fact, so another
 * person's row is never loaded into memory. This function previously took no
 * argument and returned every row in the table. */
export async function listSavedSearchesForServer(userId: string): Promise<SavedSearchState[]> {
  if (!userId) return [];
  if (!isPrismaSavedSearchStorage()) return listSavedSearches(userId);
  const db = prisma();
  const rows = (await db.savedSearch.findMany({
    where: { userId },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
  })) as Array<Record<string, unknown>>;
  return rows.map(rowToContract);
}

/** Delete one of the CALLER's saved searches. The ownership predicate is part
    of the delete itself, so there is no read-then-write window in which the
    row could change hands, and a foreign id simply deletes nothing. */
export async function deleteSavedSearchForServer(id: string, userId: string): Promise<boolean> {
  if (!userId) return false;
  if (!isPrismaSavedSearchStorage()) return deleteSavedSearch(id, userId);
  const db = prisma();
  /* `delete` throws P2025 for a missing id (→ 500); `deleteMany` reports the
     row count, which is exactly what the route's 404 decision needs. */
  const deleted = await db.savedSearch.deleteMany({ where: { id, userId } });
  return deleted.count > 0;
}
