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
  const dedupeKey = dedupeKeyForSavedSearch({ query, filters, sort });

  /* Dedupe via the persisted key so a repeat save returns the existing row as
     a duplicate instead of stacking rows the user has to clean up. */
  const existing = (await db.savedSearch.findFirst({ where: { dedupeKey } })) as Record<string, unknown> | null;
  if (existing) {
    return { ok: true, savedSearch: rowToContract(existing), duplicate: true };
  }

  const created = (await db.savedSearch.create({
    data: {
      query,
      filters,
      sort,
      notify: input.notify ?? false,
      dedupeKey,
    },
  })) as Record<string, unknown>;
  return { ok: true, savedSearch: rowToContract(created), duplicate: false };
}

export async function listSavedSearchesForServer(): Promise<SavedSearchState[]> {
  if (!isPrismaSavedSearchStorage()) return listSavedSearches();
  const db = prisma();
  const rows = (await db.savedSearch.findMany({ orderBy: { updatedAt: "desc" } })) as Array<Record<string, unknown>>;
  return rows.map(rowToContract);
}

export async function deleteSavedSearchForServer(id: string): Promise<boolean> {
  if (!isPrismaSavedSearchStorage()) return deleteSavedSearch(id);
  const db = prisma();
  /* `delete` throws P2025 for a missing id (→ 500); `deleteMany` reports the
     row count, which is exactly what the route's 404 decision needs. */
  const deleted = await db.savedSearch.deleteMany({ where: { id } });
  return deleted.count > 0;
}
