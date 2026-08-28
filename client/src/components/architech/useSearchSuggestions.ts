"use client";
/* Debounced, abortable search-suggestions hook (P1-SEARCH-002 frontend).
   Fetches `/api/search/suggest` with a short debounce, aborts in-flight requests
   and stale results, and never resolves a request after the component unmounts.
   Server-backed, so suggestions stay consistent with the canonical alias module
   rather than a client-side reimplementation. */

import { useEffect, useState } from "react";
import type { SearchSuggestion } from "@/lib/search/suggest";

const DEBOUNCE_MS = 180;

export type SearchSuggestionsState = {
  suggestions: SearchSuggestion[];
  loading: boolean;
  error: string | null;
};

export function useSearchSuggestions(query: string, citySlug?: string): SearchSuggestionsState {
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const trimmed = query.trim();
    // Empty query: show curated popular suggestions, still debounced to avoid
    // a request on every keystroke of whitespace.
    if (trimmed.length === 0) {
      setSuggestions([]);
      setLoading(false);
      setError(null);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const scope = citySlug && citySlug !== "all" ? `&city=${encodeURIComponent(citySlug)}` : "";
        const response = await fetch(`/api/search/suggest/?q=${encodeURIComponent(trimmed)}${scope}`, { signal: controller.signal });
        if (!response.ok) throw new Error(`suggest ${response.status}`);
        const payload = await response.json();
        if (Array.isArray(payload.suggestions)) setSuggestions(payload.suggestions as SearchSuggestion[]);
      } catch (err) {
        if (controller.signal.aborted) return; // ignore aborted requests
        setError(err instanceof Error ? err.message : "Could not load suggestions.");
        setSuggestions([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [citySlug, query]);

  return { suggestions, loading, error };
}
