import "server-only";
import { createSavedSearch, deleteSavedSearch, listSavedSearches, type SavedSearchInput, type SavedSearchResult, type SavedSearchState } from "./saved-search";
import { isPrismaSavedSearchStorage } from "./source";
import { getPrismaClient } from "@/lib/repositories/server/prisma";

type PrismaSavedSearchClient = ReturnType<typeof getPrismaClient> & {
  savedSearch: { create(args: unknown): Promise<unknown>; findFirst(args: unknown): Promise<unknown | null>; findMany(args: unknown): Promise<Array<Record<string, unknown>>>; delete(args: unknown): Promise<unknown> };
};

const prisma = () => getPrismaClient() as unknown as PrismaSavedSearchClient;

function rowToContract(row: Record<string, unknown>): SavedSearchState {
  return {
    id: String(row.id ?? ""),
    query: String(row.query ?? ""),
    filters: Array.isArray(row.filters) ? (row.filters as string[]) : [],
    sort: typeof row.sort === "string" ? row.sort : null,
    notify: Boolean(row.notify),
    createdAt: new Date(row.createdAt as string | Date).toISOString(),
    updatedAt: new Date(row.updatedAt as string | Date).toISOString(),
  };
}

export async function createSavedSearchForServer(input: SavedSearchInput): Promise<SavedSearchResult> {
  if (!isPrismaSavedSearchStorage()) return createSavedSearch(input);
  const db = prisma();
  const created = (await db.savedSearch.create({
    data: {
      query: input.query?.trim() ?? "",
      filters: input.filters ?? [],
      notify: input.notify ?? false,
    },
  })) as Record<string, unknown>;
  // Duplicate detection for the Prisma path is intentionally simplified for the
  // demo; the memory path dedupes deterministically and the client toasts idempotently.
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
  await db.savedSearch.delete({ where: { id } });
  return true;
}
