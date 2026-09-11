import { describe, expect, it } from "vitest";
import { cities } from "@/lib/cities";
import { localities } from "@/lib/localities";
/* The seed registry is plain ESM; vitest resolves .mjs exactly like node. */
import { CITIES, LOCALITIES } from "../../../prisma/seed-registry.mjs";

/* Entity locale completeness (P1-I18N-001).
 *
 * Every public place entity must carry a REAL Devanagari name in BOTH
 * corpora — the fixture registry the site renders from, and the Prisma seed
 * registry the database starts from. Without this pin a new city or locality
 * would ship with an English name on Hindi pages because the mappers fall
 * back (`row.hindiName ?? row.name`) instead of failing, and the fallback is
 * invisible until someone reads a Hindi locality page aloud. */

/* "Contains Devanagari", not "exclusively Devanagari": official names like
   Salt Lake Sector V correctly keep their Roman sector numeral
   ("साल्ट लेक सेक्टर V"), while an English passthrough fails. */
const CONTAINS_DEVANAGARI = /[ऀ-ॿ]/u;

function expectDevanagari(value: string | undefined | null, label: string) {
  expect(value, `${label} must carry a Hindi name`).toBeTruthy();
  expect(value, `${label} Hindi name must contain Devanagari, got "${value}"`).toMatch(CONTAINS_DEVANAGARI);
}

describe("entity locale fields", () => {
  it("every fixture city carries a real Hindi name", () => {
    expect(cities.length).toBeGreaterThanOrEqual(12);
    for (const city of cities) {
      expectDevanagari(city.hindi, `city ${city.slug}`);
      expect(city.hindi, `city ${city.slug} Hindi name must be a translation, not the English name copied`).not.toBe(city.name);
    }
  });

  it("every fixture locality carries a real Hindi name", () => {
    expect(localities.length).toBeGreaterThan(50);
    for (const locality of localities) {
      expectDevanagari(locality.hindi, `locality ${locality.citySlug}/${locality.slug}`);
    }
  });

  it("every seeded city carries a Devanagari hindiName", () => {
    for (const city of CITIES) {
      expectDevanagari(city.hindiName, `seed city ${city.slug}`);
    }
  });

  it("every seeded locality carries a Devanagari hindiName", () => {
    expect(LOCALITIES.length).toBeGreaterThan(50);
    for (const locality of LOCALITIES) {
      expectDevanagari(locality.hindiName, `seed locality ${locality.slug}`);
    }
  });

  it("the seed registry covers every fixture city (parity — no silent gaps)", () => {
    /* Locality sets legitimately drift (the seed follows real inventory), but
       a CITY missing from the seed makes its seeded listings land nowhere.
       Fail loudly instead of shipping an empty seeded city page. */
    const seedSlugs = new Set(CITIES.map((city) => city.slug));
    for (const city of cities) {
      expect(seedSlugs.has(city.slug), `fixture city ${city.slug} must exist in the seed registry`).toBe(true);
    }
  });
});
