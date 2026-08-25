/* Saved-search domain model (memory store).
   A buyer can save a search and be alerted when matching inventory arrives.
   The persisted record is minimal and consent-aware; it never stores PII. */

export type SavedSearchState = {
  id: string;
  query: string;
  filters: string[];
  sort: string | null;
  notify: boolean;
  createdAt: string;
  updatedAt: string;
};

export type SavedSearchInput = {
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

export function validateSavedSearchInput(input: Partial<SavedSearchInput>): string[] {
  const errors: string[] = [];
  const hasQuery = typeof input.query === "string" && input.query.trim().length > 0;
  const hasFilters = Array.isArray(input.filters) && input.filters.length > 0;
  if (!hasQuery && !hasFilters) errors.push("A saved search needs a query or at least one filter.");
  if (input.query && input.query.trim().length > 120) errors.push("Saved search query is too long.");
  if (input.filters && input.filters.some((f) => typeof f !== "string")) errors.push("Filters must be strings.");
  return errors;
}

export function createSavedSearch(input: SavedSearchInput): SavedSearchResult {
  const errors = validateSavedSearchInput(input);
  if (errors.length) return { ok: false, status: 400, errors };

  const query = input.query?.trim() ?? "";
  const filters = (input.filters ?? []).map((f) => f.trim()).filter(Boolean);
  const sort = input.sort ?? null;
  const notify = input.notify ?? false;

  const key = `${query}::${[...filters].sort().join(",")}::${sort ?? ""}`;
  const id = stableId("saved_search", key);
  const existing = store.get(id);
  if (existing) return { ok: true, savedSearch: existing, duplicate: true };

  const now = new Date().toISOString();
  const savedSearch: SavedSearchState = { id, query, filters, sort, notify, createdAt: now, updatedAt: now };
  store.set(id, savedSearch);
  return { ok: true, savedSearch, duplicate: false };
}

export function listSavedSearches(): SavedSearchState[] {
  return [...store.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function deleteSavedSearch(id: string): boolean {
  return store.delete(id);
}

export function resetSavedSearchStoreForTests() {
  store.clear();
}
