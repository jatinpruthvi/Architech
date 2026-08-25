/* Search suggestion module.
   Deterministic, server-safe and side-effect free so it can be shared by the
   client hero search and a server suggestion endpoint. Suggestion relevance is
   derived from locality names (en + Devanagari aliases), listing titles, and a
   curated set of popular queries — never from free text generation. */

import { localities } from "@/lib/localities";
import { getListings } from "@/lib/repositories";

export type SearchSuggestionKind = "locality" | "listing" | "popular" | "query";

export type SearchSuggestion = {
  kind: SearchSuggestionKind;
  label: string;
  query: string;
  /** Optional human hint (e.g. "42 homes · Paldi"). */
  hint?: string;
};

export const POPULAR_QUERIES = [
  "3 BHK in Paldi",
  "Courtyard homes",
  "New launches in Bopal",
  "Under ₹1 Cr",
  "RERA verified",
] as const;

export const MAX_SUGGESTIONS = 8;

function normalizeForMatch(value: string): string {
  return value.toLowerCase().trim();
}

/**
 * Return up to `limit` suggestions relevant to `query`.
 * Empty/blank query returns curated popular queries.
 */
export function suggestSearch(query: string, limit = MAX_SUGGESTIONS): SearchSuggestion[] {
  const q = normalizeForMatch(query);
  const suggestions: SearchSuggestion[] = [];

  if (!q) {
    for (const popular of POPULAR_QUERIES) {
      suggestions.push({ kind: "popular", label: popular, query: popular });
    }
    return suggestions.slice(0, limit);
  }

  // Locality matches by English or Devanagari name.
  for (const locality of localities) {
    if (!locality.name.toLowerCase().includes(q) && !locality.hindi.includes(q)) continue;
    suggestions.push({
      kind: "locality",
      label: locality.name,
      query: locality.name,
      hint: `${locality.homes} homes · ${locality.note}`,
    });
  }

  // Listing title matches.
  for (const listing of getListings()) {
    if (suggestions.length >= limit) break;
    if (!listing.title.toLowerCase().includes(q)) continue;
    suggestions.push({
      kind: "listing",
      label: listing.title,
      query: listing.title,
      hint: `${listing.locality} · ${listing.price}`,
    });
  }

  // Popular queries mentioning the substring.
  if (suggestions.length < limit) {
    for (const popular of POPULAR_QUERIES) {
      if (suggestions.length >= limit) break;
      if (!popular.toLowerCase().includes(q)) continue;
      suggestions.push({ kind: "popular", label: popular, query: popular });
    }
  }

  return suggestions.slice(0, limit);
}

/** Suggestions for typing a raw query, including a "search for it" entry. */
export function suggestSearchIncludingRaw(query: string, limit = MAX_SUGGESTIONS): SearchSuggestion[] {
  const q = query.trim();
  const matches = suggestSearch(q, limit);
  if (q && !matches.some((item) => item.query.toLowerCase() === q.toLowerCase())) {
    const rawEntry: SearchSuggestion = { kind: "query", label: q, query: q };
    return [rawEntry, ...matches].slice(0, limit);
  }
  return matches;
}
