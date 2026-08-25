/* No-results recovery.
   When a search produces zero homes, offer honest, derived alternatives rather
   than an empty dead end: nearby localities, popular queries, and a clear
   remove-filters CTA. Deterministic and server-safe. */

import { localities } from "@/lib/localities";
import { getListings } from "@/lib/repositories";
import { normalizeSearchTokens } from "./sql";
import { POPULAR_QUERIES, type SearchSuggestion } from "./suggest";

export type RecoveryPlan = {
  /** Low-constraint alternative queries that should return results. */
  alternativeQueries: SearchSuggestion[];
  /** Localities to browse instead (within the city). */
  relatedLocalities: SearchSuggestion[];
  /** True when the query or filters are unnecessarily restrictive. */
  suggestRemovingFilters: boolean;
};

function localitySuggestion(slug: string): SearchSuggestion | undefined {
  const locality = localities.find((item) => item.slug === slug);
  if (!locality) return undefined;
  return {
    kind: "locality",
    label: locality.name,
    query: locality.name,
    hint: `${locality.homes} homes · ${locality.note}`,
  };
}

/** Derive a fallback locality when a query names one that is known. */
function knownLocalityFromQuery(query: string): SearchSuggestion | undefined {
  const tokens = normalizeSearchTokens(query).map((token) => token.toLowerCase());
  for (const token of tokens) {
    const match = localities.find((locality) => locality.slug === token || locality.name.toLowerCase() === token || locality.hindi.includes(token));
    if (match) return localitySuggestion(match.slug);
  }
  return undefined;
}

/**
 * Build a recovery plan for a zero-result search.
 * @param query   the search query the user typed
 * @param filters active filter ids
 */
export function buildSearchRecovery(query: string, filters: string[] = []): RecoveryPlan {
  const alternativeQueries: SearchSuggestion[] = [];
  const relatedLocalities: SearchSuggestion[] = [];

  const namedLocality = knownLocalityFromQuery(query);
  if (namedLocality) relatedLocalities.push(namedLocality);

  // Add the localities with inventory, preferring ones with the most homes.
  const byInventory = [...localities].sort((a, b) => b.homes - a.homes);
  for (const locality of byInventory) {
    if (relatedLocalities.length >= 4) break;
    const suggestion = localitySuggestion(locality.slug);
    if (suggestion && !relatedLocalities.some((item) => item.query === suggestion.query)) {
      relatedLocalities.push(suggestion);
    }
  }

  // Popular queries that match the intent, minus anything already offered.
  for (const popular of POPULAR_QUERIES) {
    if (alternativeQueries.length >= 3) break;
    if (alternativeQueries.some((item) => item.query === popular)) continue;
    alternativeQueries.push({ kind: "popular", label: popular, query: popular });
  }
  if (alternativeQueries.length === 0 && getListings().length > 0) {
    alternativeQueries.unshift({ kind: "popular", label: "All homes", query: "" });
  }

  const suggestRemovingFilters = filters.length > 0 || Boolean(query);

  return { alternativeQueries, relatedLocalities, suggestRemovingFilters };
}
