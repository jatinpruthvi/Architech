/* Command palette (⌘K) entry model — pure, framework-free logic.
   The UI layer (CommandPalette.tsx) renders whatever this returns, so ranking
   rules stay unit-testable and the server-backed suggestion ranker remains the
   single authority on ordering (see search/suggest.ts: suggestions are ranked,
   not filtered — the palette never re-ranks them). */

import type { SearchSuggestion } from "./suggestion-types";

export type PaletteEntryKind = SearchSuggestion["kind"] | "action";

export type PaletteEntry = {
  /** Stable, unique-per-list id for cmdk value/rendering keys. */
  id: string;
  kind: PaletteEntryKind;
  label: string;
  hint?: string;
  /** Direct destination; preferred over query when both exist. */
  href?: string;
  /** Free-text query to run on /search/ when no href exists. */
  query?: string;
};

export type PaletteCopy = {
  searchForPrefix: string;
};

export type PaletteGroups = {
  /** Always-first entries the person typed before (device-local). */
  recents: PaletteEntry[];
  /** Server-ranked suggestions for the current query. */
  suggestions: PaletteEntry[];
  /** Static navigation actions shown only when the query is empty. */
  actions: PaletteEntry[];
  /** The always-available "run this exact text" entry while typing. */
  runQuery: PaletteEntry | null;
};

/** Static quick-navigation actions. Routes are the canonical trailing-slash
    URLs so the palette never mints a URL variant the sitemap does not know. */
export const QUICK_ACTIONS: ReadonlyArray<{ id: string; href: string }> = [
  { id: "go-buy", href: "/buy/" },
  { id: "go-search", href: "/search/" },
  { id: "go-saved", href: "/saved/" },
  { id: "go-saved-searches", href: "/saved-searches/" },
  { id: "go-guide", href: "/guide/" },
  { id: "go-list-property", href: "/list-property/" },
] as const;

function entryId(kind: PaletteEntryKind, index: number, label: string, href?: string) {
  return `${kind}:${index}:${href ?? label.toLowerCase()}`;
}

export function suggestionToEntry(suggestion: SearchSuggestion, index: number): PaletteEntry {
  const href = suggestion.href;
  return {
    id: entryId(suggestion.kind, index, suggestion.label, href),
    kind: suggestion.kind,
    label: suggestion.label,
    hint: suggestion.hint,
    href,
    query: href ? undefined : suggestion.query || suggestion.label,
  };
}

export function recentToEntry(recent: SearchSuggestion, index: number): PaletteEntry {
  return {
    id: entryId("query", index, recent.label),
    kind: "query",
    label: recent.label,
    hint: recent.hint,
    query: recent.query || recent.label,
  };
}

/**
 * Build the whole palette state from inputs.
 *
 * Empty query: recents (device-local, newest first) + navigation actions.
 * Typing: server-ranked suggestions, then the literal query runner last, so a
 * suggestion never hides the option to just search the typed text.
 */
export function buildPaletteGroups(input: {
  query: string;
  recents: SearchSuggestion[];
  suggestions: SearchSuggestion[];
  quickActionLabels: Record<string, string>;
  searchForPrefix: string;
}): PaletteGroups {
  const query = input.query.trim();

  if (query.length === 0) {
    return {
      recents: input.recents.map(recentToEntry),
      suggestions: [],
      /* An action without a reviewed label is omitted, never rendered as a
         raw id — a localized UI shows nothing it cannot say properly. */
      actions: QUICK_ACTIONS.flatMap((action, index) => {
        const label = input.quickActionLabels[action.id];
        if (!label) return [];
        return [{ id: entryId("action", index, action.id, action.href), kind: "action" as const, label, href: action.href }];
      }),
      runQuery: null,
    };
  }

  return {
    recents: [],
    suggestions: input.suggestions.map(suggestionToEntry),
    actions: [],
    runQuery: {
      id: entryId("query", -1, query),
      kind: "query",
      label: `${input.searchForPrefix} “${query}”`,
      query,
    },
  };
}

/** Build the /search/ URL for a free-text query. */
export function searchUrlForQuery(query: string): string {
  const params = new URLSearchParams({ q: query });
  return `/search/?${params.toString()}`;
}
