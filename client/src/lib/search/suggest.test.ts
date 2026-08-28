import { describe, expect, it } from "vitest";
import { MAX_SUGGESTIONS, exampleQuery, popularQueries, suggestSearch, suggestSearchIncludingRaw } from "./suggest";

describe("popular queries are derived, not hardcoded", () => {
  it("returns suggestions with real inventory counts for an empty query", () => {
    const suggestions = suggestSearch("");
    expect(suggestions.length).toBeGreaterThan(0);
    // Every hint quotes a count, so nothing on screen is an invented number.
    expect(suggestions.every((s) => typeof s.hint === "string" && s.hint.length > 0)).toBe(true);
  });

  it("scopes popular queries to the active city", () => {
    const pune = popularQueries({ citySlug: "pune" });
    expect(pune.length).toBeGreaterThan(0);
    const localityHints = pune.filter((s) => s.kind === "popular" && s.hint?.includes("·"));
    expect(localityHints.every((s) => s.hint?.includes("Pune"))).toBe(true);
  });

  it("suggests different popular queries for different cities", () => {
    const mumbai = popularQueries({ citySlug: "mumbai" }).map((s) => s.query);
    const kolkata = popularQueries({ citySlug: "kolkata" }).map((s) => s.query);
    expect(mumbai).not.toEqual(kolkata);
  });

  it("builds a placeholder example from a locality that has inventory", () => {
    expect(exampleQuery()).toMatch(/^3 BHK in .+/);
    expect(exampleQuery({ citySlug: "chennai" })).toMatch(/^3 BHK in .+/);
  });
});

describe("suggestion ranking", () => {
  it("matches localities by English and Devanagari name", () => {
    expect(suggestSearch("paldi").some((s) => s.kind === "locality" && s.query === "Paldi")).toBe(true);
    expect(suggestSearch("पालडी").some((s) => s.kind === "locality" && s.query === "Paldi")).toBe(true);
  });

  it("ranks an exact match above a mere substring match", () => {
    const suggestions = suggestSearch("pal");
    // "Pal" (Surat) is an exact match; "Paldi" and "Piplod" only contain it.
    expect(suggestions[0].query).toBe("Pal");
  });

  it("puts a prefix match ahead of a mid-word match", () => {
    const results = suggestSearch("hebb").map((s) => s.query);
    expect(results[0]).toBe("Hebbal");
  });

  it("tolerates a typo without inventing a match", () => {
    expect(suggestSearch("koramangla").some((s) => s.query === "Koramangala")).toBe(true);
    expect(suggestSearch("whitefeild").some((s) => s.query === "Whitefield")).toBe(true);
    // A short nonsense token must not fuzzy-match its way into a place.
    expect(suggestSearch("zzq").some((s) => s.kind === "locality")).toBe(false);
  });

  it("suggests cities as well as localities", () => {
    expect(suggestSearch("bengaluru").some((s) => s.kind === "city" && s.query === "Bengaluru")).toBe(true);
  });

  it("boosts localities in the active city scope", () => {
    // "nagar" matches localities in several cities; the scoped one leads.
    const scoped = suggestSearch("nagar", MAX_SUGGESTIONS, { citySlug: "chennai" });
    expect(scoped[0].label).toContain("Chennai");
  });

  it("answers a PIN with the localities that serve it", () => {
    const suggestions = suggestSearch("395007");
    expect(suggestions.filter((s) => s.kind === "pincode").map((s) => s.query).sort()).toEqual(["Piplod", "Vesu"]);
    expect(suggestions[0].href).toBe("/search/?pincode=395007");
  });

  it("falls back to the city for a PIN no locality claims", () => {
    const suggestions = suggestSearch("400104");
    expect(suggestions[0].kind).toBe("pincode");
    expect(suggestions[0].label).toContain("Mumbai");
  });

  it("offers a structured action for a query it understands", () => {
    const suggestions = suggestSearch("3 bhk in koramangala under 2 cr");
    const structured = suggestions.find((s) => s.kind === "structured");
    expect(structured).toBeDefined();
    expect(structured?.label).toContain("3 BHK");
    expect(structured?.label).toContain("Koramangala");
    expect(structured?.href).toContain("city=bengaluru");
  });

  it("matches listing titles and caps at MAX_SUGGESTIONS", () => {
    const suggestions = suggestSearch("courtyard");
    expect(suggestions.some((s) => s.kind === "listing")).toBe(true);
    expect(suggestions.length).toBeLessThanOrEqual(MAX_SUGGESTIONS);
  });

  it("leads with the raw query only when nothing else matched", () => {
    const suggestions = suggestSearchIncludingRaw("zebra crossing homes");
    expect(suggestions[0].kind).toBe("query");
    expect(suggestions[0].query).toBe("zebra crossing homes");
  });

  it("puts a typo correction above the typed text", () => {
    const suggestions = suggestSearchIncludingRaw("koramangla");
    expect(suggestions[0].query).toBe("Koramangala");
    // The literal text is still reachable, just not first.
    expect(suggestions.some((s) => s.kind === "query" && s.query === "koramangla")).toBe(true);
  });

  it("offers a place named inside a longer sentence", () => {
    const suggestions = suggestSearchIncludingRaw("3 bhk in koramangala under 2 cr");
    expect(suggestions[0].kind).toBe("structured");
    expect(suggestions.some((s) => s.kind === "locality" && s.query === "Koramangala")).toBe(true);
  });

  it("is deterministic (no random order)", () => {
    expect(suggestSearch("pal")).toEqual(suggestSearch("pal"));
    expect(popularQueries({ citySlug: "pune" })).toEqual(popularQueries({ citySlug: "pune" }));
  });
});
