"use client";
/* Recent searches.

   The hero used to show two invented strings ("3 BHK near Law Garden") to
   everyone, which is a claim about the visitor's history that is simply not
   true. This stores what someone actually searched, on their own device only.

   Deliberately localStorage and not the server: search history is personal
   data, and nothing here is worth asking for consent over. Every read is
   defensive, because localStorage throws in private-mode Safari and can hold
   anything a previous version wrote. */

import type { SearchSuggestion } from "./suggestion-types";

const STORAGE_KEY = "architech:recent-searches";
const MAX_RECENTS = 3;

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

/** Recent queries as suggestions, newest first. Empty when there are none. */
export function readRecentSearches(limit = MAX_RECENTS): SearchSuggestion[] {
  if (!canUseStorage()) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
      .slice(0, limit)
      .map((query) => ({ kind: "query", label: query, query, hint: "Recent search" }));
  } catch {
    return [];
  }
}

/** Record a query, most recent first, de-duplicated case-insensitively. */
export function rememberRecentSearch(query: string): void {
  if (!canUseStorage()) return;
  const trimmed = query.trim();
  if (!trimmed) return;
  try {
    const existing = readRecentSearches(MAX_RECENTS * 2).map((item) => item.query);
    const next = [trimmed, ...existing.filter((item) => item.toLowerCase() !== trimmed.toLowerCase())].slice(0, MAX_RECENTS);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* Storage full or blocked — recents are a convenience, never a requirement. */
  }
}

/** Clear the stored history. */
export function clearRecentSearches(): void {
  if (!canUseStorage()) return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
