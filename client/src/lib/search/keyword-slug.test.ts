/* Keyword URL resolution (StudyArena round-12, contestant F §1 and §4).

   F's example queries — "2 bhk for rent in [locality]" — arrive as URL slugs,
   and two routes answered them by matching literals inside the joined string.
   `/property/` recognised two cities, so anything that was not "gandhinagar"
   became **Ahmedabad**; `/property-search/` recognised ten Ahmedabad
   localities and produced an empty query for the other 62.

   Both now resolve through `parseSearchQuery`, which already reads BHK,
   budget, intent, category, PIN codes and place names against the live
   registry. These tests pin the behaviour that two hardcoded lists could not
   deliver: a slug names a place anywhere in the country and lands on it.

   They also assert consistency with the app rather than a private answer.
   Whatever typing the same words into the search box produces is what the
   slug must produce — one resolver, not a second opinion that can drift. */
import { describe, expect, it } from "vitest";
import { keywordSlugToSearchUrl } from "./keyword-slug";
import { parseSearchQuery, parsedQueryToSearchUrl } from "./parse-query";
import { getCities, getLocalities } from "../repositories";

const url = (slug: string) => keywordSlugToSearchUrl(slug.split("/").filter(Boolean));

describe("keyword slug resolution", () => {
  it("resolves a Mumbai slug to Mumbai, not to a default city", () => {
    // The defect: this returned an Ahmedabad search before.
    const target = url("2bhk-rent-bandra-west");
    expect(target).toContain("city=mumbai");
    expect(target).toContain("intent=rent");
    expect(target).toContain("2bhk");
  });

  it("resolves a Bengaluru slug to Bengaluru", () => {
    expect(url("rent-whitefield")).toContain("city=bengaluru");
    expect(url("flats-in-koramangala")).toContain("city=bengaluru");
  });

  it("reads the configuration out of the slug", () => {
    expect(url("3bhk-sale-powai")).toContain("3bhk");
    expect(url("2bhk-rent-bopal")).toContain("2bhk");
  });

  it("reads intent, and leaves buy unmarked the way search does", () => {
    expect(url("2bhk-rent-bopal")).toContain("intent=rent");
    expect(url("3bhk-sale-powai")).not.toContain("intent=");
  });

  /* The second defect: a locality outside the hardcoded ten resolved to
     nothing. Every locality the site covers must resolve to its own city. */
  it("resolves every locality the site covers", () => {
    for (const city of getCities()) {
      for (const locality of getLocalities(city.slug)) {
        const target = keywordSlugToSearchUrl([`2bhk-rent-${locality.slug}`]);
        expect(target, `${city.slug}/${locality.slug}`).toContain(`city=${city.slug}`);
      }
    }
  });

  /* Guessing a city for an unrecognised place is worse than asking: it serves
     a confident, wrong result set instead of an open search. */
  it("does not default an unknown place to a city", () => {
    const target = url("2bhk-rent-somewhere-unmapped");
    expect(target).not.toContain("city=");
    expect(target).toContain("/search/");
  });

  it("sends an empty slug to the open search rather than to a guessed city", () => {
    expect(keywordSlugToSearchUrl([])).toBe("/search/");
    expect(keywordSlugToSearchUrl([""])).toBe("/search/");
  });

  it("treats hyphens, underscores and spaces as one separator", () => {
    expect(keywordSlugToSearchUrl(["2bhk", "rent", "bopal"])).toBe(keywordSlugToSearchUrl(["2bhk_rent_bopal"]));
    expect(keywordSlugToSearchUrl(["2bhk rent bopal"])).toBe(keywordSlugToSearchUrl(["2bhk-rent-bopal"]));
  });

  /* The point of routing through the app's parser: a slug and the same words
     typed into the search box are the same query, now and after any change to
     the vocabulary. */
  it("agrees with the app's own parser for every slug it is given", () => {
    for (const slug of ["2bhk-rent-bandra-west", "3bhk-sale-powai", "flats-in-koramangala", "office-space-gurugram", "plots-in-pune"]) {
      const text = slug.replace(/[-_+]+/g, " ");
      expect(keywordSlugToSearchUrl([slug]), slug).toBe(parsedQueryToSearchUrl(parseSearchQuery(text)));
    }
  });
});
