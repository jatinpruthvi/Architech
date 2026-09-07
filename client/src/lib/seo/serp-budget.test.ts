import { describe, expect, it } from "vitest";
import {
  SERP_BRAND_SUFFIX,
  SERP_DESCRIPTION_MAX,
  SERP_TITLE_BUDGET,
  SERP_TITLE_MAX,
  citySerpTitle,
  rentCitySerpDescription,
  rentCitySerpTitle,
  rentLocalitySerpDescription,
  rentLocalitySerpTitle,
} from "./serp";
import { getCities } from "@/lib/repositories";

/* Regression cover for four SERP defects found by auditing rendered HTML
 * rather than source. Every one of them passed `tsc`, lint, and the whole
 * existing suite, because nothing measured the strings a searcher actually
 * sees:
 *
 *   1. Rent titles were hand-written with their own "| Architech" while the
 *      root layout also appends " · Architech" -> 72 chars, double-branded.
 *   2. Rent metadata bypassed the budget helpers entirely.
 *   3. citySerpTitle passed mutually-exclusive tails straight to serpTitle,
 *      which stops at the first that does not fit, so every city hub shipped
 *      a bare 28-character title.
 *
 * The rule these tests encode: a page title must fit in 60 characters WITH the
 * brand suffix the layout adds, and must not carry its own brand. */

const CITY = { name: "Ahmedabad", state: "Gujarat", localities: ["Paldi", "Navrangpura"] };
const LOCALITY = { name: "Bopal", cityName: "Ahmedabad", pincodes: ["380058"], note: "Ring-road suburb" };

/** What the user actually sees once the root layout applies its template. */
const rendered = (title: string) => `${title}${SERP_BRAND_SUFFIX}`;

describe("titles fit the SERP budget once the brand suffix is added", () => {
  const titles: Array<[string, string]> = [
    ["rent city", rentCitySerpTitle(CITY)],
    ["rent locality", rentLocalitySerpTitle(LOCALITY)],
    ["buy city", citySerpTitle(CITY)],
  ];

  it.each(titles)("%s title stays within the raw budget", (_label, title) => {
    expect(title.length).toBeLessThanOrEqual(SERP_TITLE_BUDGET);
  });

  it.each(titles)("%s title still fits after the layout appends the brand", (_label, title) => {
    expect(rendered(title).length).toBeLessThanOrEqual(SERP_TITLE_MAX);
  });

  it.each(titles)("%s title does not brand itself", (_label, title) => {
    /* The layout owns branding. A page that adds its own produces
       "... | Architech · Architech", which is what shipped. */
    expect(title).not.toMatch(/architech/i);
    expect(title).not.toContain("|");
  });
});

describe("descriptions fit the SERP budget", () => {
  it.each([
    ["rent city", rentCitySerpDescription(CITY)],
    ["rent locality", rentLocalitySerpDescription(LOCALITY)],
  ])("%s description stays within budget", (_label, description) => {
    expect(description.length).toBeLessThanOrEqual(SERP_DESCRIPTION_MAX);
  });
});

describe("rent copy never inherits sale wording", () => {
  it("titles talk about renting", () => {
    expect(rentCitySerpTitle(CITY)).toMatch(/rent/i);
    expect(rentLocalitySerpTitle(LOCALITY)).toMatch(/rent/i);
  });

  it("descriptions never say for sale or buy", () => {
    for (const text of [rentCitySerpDescription(CITY), rentLocalitySerpDescription(LOCALITY)]) {
      expect(text).not.toMatch(/for sale|buy in/i);
    }
  });

  it("buy and rent city titles are distinct", () => {
    expect(rentCitySerpTitle(CITY)).not.toBe(citySerpTitle(CITY));
  });
});

describe("titles use the space they are given", () => {
  /* The bug this catches is silent: a title that is merely SHORT looks fine in
     code review. "Buy in Ahmedabad" is correct, fits, and wastes ~20
     characters of the strongest ranking real estate on the page. */
  it("every real city hub earns a qualifying tail", () => {
    for (const city of getCities()) {
      const title = citySerpTitle({ name: city.name, state: city.state });
      expect(title, `${city.name} city title has no tail clause`).toContain("—");
      expect(rendered(title).length).toBeLessThanOrEqual(SERP_TITLE_MAX);
    }
  });

  it("picks the longest tail that fits, not the shortest", () => {
    // A short city name leaves room for the most descriptive variant.
    expect(citySerpTitle({ name: "Pune", state: "Maharashtra" })).toContain("verified context");
  });
});
