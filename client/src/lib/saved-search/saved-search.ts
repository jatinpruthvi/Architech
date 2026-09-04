/* Saved-search domain model (memory store).
   A buyer can save a search and be alerted when matching inventory arrives.
   The persisted record is minimal and consent-aware; it never stores PII. */

export type SavedSearchState = {
  id: string;
  /** Owning account. Null only for rows created before ownership existed. */
  userId?: string | null;
  query: string;
  filters: string[];
  sort: string | null;
  notify: boolean;
  createdAt: string;
  updatedAt: string;
};

export type SavedSearchInput = {
  /* Server-assigned ONLY. The route overwrites whatever arrives in the body
     with the id from the verified session, so a caller cannot save a search
     onto someone else's account or read one back by claiming their id. */
  userId?: string | null;
  query: string;
  filters?: string[];
  sort?: string | null;
  notify?: boolean;
};

export type SavedSearchResult =
  | { ok: true; savedSearch: SavedSearchState; duplicate: boolean }
  | { ok: false; status: number; errors: string[] };

const store = new Map<string, SavedSearchState>();

function stableId(prefix: string, key: string): string {
  let hash = 0;
  for (const char of key) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return `${prefix}_${hash.toString(36)}`;
}

/** Canonical identity of a saved search: normalized query + sorted filters +
    sort. Shared by the memory and Prisma paths so duplicate detection means the
    same thing in both. */
export function dedupeKeyForSavedSearch(input: Pick<SavedSearchInput, "query" | "filters" | "sort" | "userId">): string {
  const query = input.query?.trim() ?? "";
  const filters = (input.filters ?? []).map((f) => f.trim()).filter(Boolean).sort();
  /* The key is scoped to the OWNER. `dedupeKey` is globally unique in the
     database, so a key that ignored the account meant the first person to
     save "3BHK Powai" owned that search forever: everyone else's identical
     save returned the first person's row as a duplicate and was silently
     never stored -- and, before scoping, handed them that row to read. */
  const owner = input.userId ? `u:${input.userId}` : "anon";
  return `${owner}::${query}::${filters.join(",")}::${input.sort ?? ""}`;
}

export function validateSavedSearchInput(input: Partial<SavedSearchInput>): string[] {
  const errors: string[] = [];
  const hasQuery = typeof input.query === "string" && input.query.trim().length > 0;
  const hasFilters = Array.isArray(input.filters) && input.filters.length > 0;
  if (!hasQuery && !hasFilters) errors.push("A saved search needs a query or at least one filter.");
  if (input.query && input.query.trim().length > 120) errors.push("Saved search query is too long.");
  if (input.filters && input.filters.some((f) => typeof f !== "string")) errors.push("Filters must be strings.");
  if (input.sort !== undefined && input.sort !== null && typeof input.sort !== "string") errors.push("Sort must be a string.");
  return errors;
}

export function createSavedSearch(input: SavedSearchInput): SavedSearchResult {
  const errors = validateSavedSearchInput(input);
  if (errors.length) return { ok: false, status: 400, errors };

  const query = input.query?.trim() ?? "";
  const filters = (input.filters ?? []).map((f) => f.trim()).filter(Boolean);
  const sort = input.sort ?? null;
  const notify = input.notify ?? false;

  const key = dedupeKeyForSavedSearch({ query, filters, sort, userId: input.userId });
  const id = stableId("saved_search", key);
  const existing = store.get(id);
  if (existing) return { ok: true, savedSearch: existing, duplicate: true };

  const now = new Date().toISOString();
  const savedSearch: SavedSearchState = { id, userId: input.userId ?? null, query, filters, sort, notify, createdAt: now, updatedAt: now };
  store.set(id, savedSearch);
  return { ok: true, savedSearch, duplicate: false };
}

/* One account's saved searches.
 *
 * `userId` is REQUIRED, not optional-with-a-global-fallback: an accidental
 * `listSavedSearches()` must not compile into "return everything", which is
 * exactly the shape this function used to have. */
export function listSavedSearches(userId: string): SavedSearchState[] {
  if (!userId) return [];
  return [...store.values()]
    .filter((record) => record.userId === userId)
    /* Tie-break on id: identical timestamps otherwise reshuffle between renders. */
    .sort((a, b) => (b.updatedAt.localeCompare(a.updatedAt) || b.id.localeCompare(a.id)));
}

/** Delete one of the CALLER's saved searches. Returns false for a row that
    exists but belongs to somebody else -- indistinguishable, from the
    caller's side, from a row that does not exist. */
export function deleteSavedSearch(id: string, userId: string): boolean {
  const existing = store.get(id);
  if (!existing || existing.userId !== userId) return false;
  return store.delete(id);
}

export function resetSavedSearchStoreForTests() {
  store.clear();
}
