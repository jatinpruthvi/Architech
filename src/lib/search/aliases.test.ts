import { describe, expect, it } from "vitest";
import { hindiLabelFor, localityAliases, localityMatchesToken, normalizeLocalityToken, resolveLocalitiesFromQuery } from "./aliases";

describe("search alias & transliteration", () => {
  it("normalizes Devanagari place names to a Latin canonical form", () => {
    // पालडी → paladi-ish; at minimum it is a non-empty, lowercase Latin string.
    const normalized = normalizeLocalityToken("पालडी");
    expect(normalized.length).toBeGreaterThan(0);
    expect(normalized).toBe(normalized.toLowerCase());
    expect(normalized).toMatch(/^[a-z ]+$/);
  });

  it("maps a locality to both English and Devanagari aliases", () => {
    const aliases = localityAliases("paldi");
    expect(aliases).toContain("paldi");
    expect(aliases.some((alias) => alias.length > 0 && alias !== "paldi")).toBe(true);
  });

  it("matches a English name token against a locality", () => {
    expect(localityMatchesToken("paldi", "pal")).toBe(true);
    expect(localityMatchesToken("thaltej", "thaltej")).toBe(true);
    expect(localityMatchesToken("paldi", "bopal")).toBe(false);
  });

  it("resolves localities from a mixed-language query", () => {
    const hits = resolveLocalitiesFromQuery("3 BHK पालडी near riverfront");
    expect(hits).toContain("paldi");
  });

  it("provides a Hindi label for an English locality", () => {
    expect(hindiLabelFor("Paldi")).toBe("पालडी");
    expect(hindiLabelFor("Bopal")).toBe("बोपल");
  });
});
