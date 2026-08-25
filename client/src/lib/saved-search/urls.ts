/* URL builders for saved-search (P1-SEARCH / P1-DATA-005).
   Deterministic and server-safe: maps a saved search to the canonical /search
   URL that re-runs it, and to a top-level saved-searches path. */

import type { SavedSearchState } from "./saved-search";

export function savedSearchesPath(): string {
  return "/saved-searches/";
}

/** Build the /search URL that re-runs a saved search's query + filters + sort. */
export function savedSearchRunUrl(saved: SavedSearchState): string {
  const params = new URLSearchParams();
  if (saved.query) params.set("q", saved.query);
  if (saved.filters?.length) params.set("filters", saved.filters.join(","));
  if (saved.sort && saved.sort !== "fresh") params.set("sort", saved.sort);
  const qs = params.toString();
  return `/search${qs ? `?${qs}` : ""}`;
}
