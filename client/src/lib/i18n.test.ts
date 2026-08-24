import { describe, expect, it } from "vitest";
import { strings } from "./i18n";

function flattenKeys(value: unknown, prefix = ""): string[] {
  if (Array.isArray(value)) return [prefix];
  if (!value || typeof value !== "object") return [prefix];
  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) => flattenKeys(child, prefix ? `${prefix}.${key}` : key));
}

describe("i18n dictionary", () => {
  it("keeps Hindi and English dictionary shapes aligned", () => {
    expect(flattenKeys(strings.hi).sort()).toEqual(flattenKeys(strings.en).sort());
  });

  it("includes expanded Hindi coverage for major product surfaces", () => {
    expect(strings.hi.saved.emptyCta).toContain("घर");
    expect(strings.hi.search.filterHomes).toContain("फ़िल्टर");
    expect(strings.hi.locality.verifyCta).toContain("सत्यापित");
    expect(strings.hi.listing.ask).toContain("पूछें");
    expect(strings.hi.property.view).toBe("देखें");
  });

  it("keeps the Hindi release clearly marked as partial until editorial review", () => {
    expect(strings.en.common.translationNote).toBe("");
    expect(strings.hi.common.translationNote).toContain("आंशिक अनुवाद");
    expect(strings.hi.common.translationNote).toContain("editorial content");
  });
});
