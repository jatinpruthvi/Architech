import { describe, expect, it } from "vitest";
import {
  buildPaletteGroups,
  QUICK_ACTIONS,
  recentToEntry,
  searchUrlForQuery,
  suggestionToEntry,
} from "./palette-actions";
import type { SearchSuggestion } from "./suggestion-types";

const labels: Record<string, string> = {
  "go-buy": "Explore cities",
  "go-search": "Search homes",
  "go-saved": "Saved homes",
  "go-saved-searches": "Saved searches",
  "go-guide": "Field notes",
  "go-list-property": "List your property",
};

const locality: SearchSuggestion = { kind: "locality", label: "Paldi", query: "paldi", hint: "42 homes", href: "/buy/ahmedabad/paldi/" };
const listing: SearchSuggestion = { kind: "listing", label: "Garden Courtyard", query: "garden courtyard", hint: "Paldi · ₹1.4 Cr" };

describe("command palette groups", () => {
  it("shows recents and navigation actions when the query is empty", () => {
    const groups = buildPaletteGroups({
      query: "   ",
      recents: [{ kind: "query", label: "3 bhk paldi", query: "3 bhk paldi", hint: "Recent search" }],
      suggestions: [],
      quickActionLabels: labels,
      searchForPrefix: "Search for",
    });
    expect(groups.recents).toHaveLength(1);
    expect(groups.recents[0].label).toBe("3 bhk paldi");
    expect(groups.actions).toHaveLength(QUICK_ACTIONS.length);
    expect(groups.actions.map((a) => a.href)).toContain("/buy/");
    expect(groups.suggestions).toHaveLength(0);
    expect(groups.runQuery).toBeNull();
  });

  it("omits an action rather than rendering a raw id when its label is missing", () => {
    const groups = buildPaletteGroups({
      query: "",
      recents: [],
      suggestions: [],
      quickActionLabels: { "go-buy": "Explore cities" },
      searchForPrefix: "Search for",
    });
    expect(groups.actions).toHaveLength(1);
    expect(groups.actions[0].label).toBe("Explore cities");
  });

  it("keeps server-ranked suggestions in order and appends the literal query runner last", () => {
    const groups = buildPaletteGroups({
      query: "paldi",
      recents: [],
      suggestions: [locality, listing],
      quickActionLabels: labels,
      searchForPrefix: "Search for",
    });
    expect(groups.recents).toHaveLength(0);
    expect(groups.actions).toHaveLength(0);
    expect(groups.suggestions.map((s) => s.label)).toEqual(["Paldi", "Garden Courtyard"]);
    expect(groups.runQuery?.label).toBe("Search for “paldi”");
    expect(groups.runQuery?.query).toBe("paldi");
  });

  it("prefers a suggestion's canonical href over its free-text query", () => {
    const entry = suggestionToEntry(locality, 0);
    expect(entry.href).toBe("/buy/ahmedabad/paldi/");
    expect(entry.query).toBeUndefined();
  });

  it("falls back to the query for suggestions without a canonical href", () => {
    const entry = suggestionToEntry(listing, 3);
    expect(entry.href).toBeUndefined();
    expect(entry.query).toBe("garden courtyard");
    expect(entry.id).toContain("listing:3:");
  });

  it("gives every entry a unique id", () => {
    const entries = [suggestionToEntry(locality, 0), suggestionToEntry(listing, 1), recentToEntry({ kind: "query", label: "x", query: "x" }, 0)];
    const ids = entries.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("builds lossless /search/ URLs for literal queries", () => {
    expect(searchUrlForQuery("3 bhk under 1.5 cr")).toBe("/search/?q=3+bhk+under+1.5+cr");
  });

  it("every quick action points at a canonical trailing-slash URL", () => {
    for (const action of QUICK_ACTIONS) {
      expect(action.href.startsWith("/")).toBe(true);
      expect(action.href.endsWith("/")).toBe(true);
    }
  });
});
