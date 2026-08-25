import { describe, expect, it } from "vitest";
import { MAX_SUGGESTIONS, POPULAR_QUERIES, suggestSearch, suggestSearchIncludingRaw } from "./suggest";

describe("search suggestions", () => {
  it("returns curated popular queries for an empty query", () => {
    const suggestions = suggestSearch("");
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions.every((s) => s.kind === "popular")).toBe(true);
  });

  it("matches localities by English and Devanagari name", () => {
    const en = suggestSearch("paldi");
    expect(en.some((s) => s.kind === "locality" && s.query === "Paldi")).toBe(true);

    const hindi = suggestSearch("पालडी");
    expect(hindi.some((s) => s.kind === "locality" && s.query === "Paldi")).toBe(true);
  });

  it("matches listing titles and caps at MAX_SUGGESTIONS", () => {
    const suggestions = suggestSearch("courtyard");
    expect(suggestions.some((s) => s.kind === "listing")).toBe(true);
    expect(suggestions.length).toBeLessThanOrEqual(MAX_SUGGESTIONS);
  });

  it("prepends a raw query entry when nothing matches exactly", () => {
    const suggestions = suggestSearchIncludingRaw("zebra crossing homes");
    expect(suggestions[0].kind).toBe("query");
    expect(suggestions[0].query).toBe("zebra crossing homes");
  });

  it("is deterministic (no random order)", () => {
    expect(suggestSearch("pal")).toEqual(suggestSearch("pal"));
  });

  it("exposes stable popular queries", () => {
    expect(POPULAR_QUERIES.length).toBeGreaterThan(0);
  });
});
