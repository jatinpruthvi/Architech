/* SERP length budget contract (StudyArena round-12, contestant C §7).

   C's generator spec sets a title budget of 60 characters and a description
   budget of 155. Measured before this module existed, 131 of 438 prerendered
   routes had a title over 60 and 419 of 438 had a description over 155 — the
   smoke suite only checked that a <title> element existed.

   Two things are pinned here, and they pull in opposite directions:

     1. The budget always holds. `fitSerp*` guarantees it by truncation, so a
        new long locality name can never publish an over-length tag.
     2. Truncation is never actually used for the current corpus. An ellipsis
        in a SERP snippet reads as a broken site, so if a name or note grows
        past the budget this suite fails and a human rewrites the copy.

   Guarantees that cannot fail are decoration, so the second test is the one
   that keeps the first honest. */
import { describe, expect, it } from "vitest";
import { getCities, getListings, getLocalities } from "@/lib/repositories";
import { localityIntel } from "@/lib/realestate/locality-intel";
import {
  SERP_BRAND_SUFFIX,
  SERP_DESCRIPTION_MAX,
  SERP_ELLIPSIS,
  SERP_TITLE_BUDGET,
  SERP_TITLE_MAX,
  citySerpDescription,
  citySerpTitle,
  composeSerpText,
  fitSerpText,
  isSerpTruncated,
  listingSerpDescription,
  listingSerpTitle,
  localitySerpDescription,
  localitySerpTitle,
} from "./serp";

/** Rendered length of a child title once the layout appends the brand suffix. */
function renderedTitle(title: string): number {
  return title.length + SERP_BRAND_SUFFIX.length;
}

describe("serp budget constants", () => {
  it("uses the limits C's page spec states", () => {
    expect(SERP_TITLE_MAX).toBe(60);
    expect(SERP_DESCRIPTION_MAX).toBe(155);
    // The budget a page title can use is what is left after the brand suffix.
    expect(SERP_TITLE_BUDGET).toBe(SERP_TITLE_MAX - SERP_BRAND_SUFFIX.length);
  });
});

describe("compose and fit", () => {
  it("appends parts in priority order while they fit", () => {
    expect(composeSerpText(["Homes in Paldi", "median ₹1.85 Cr", "a note"], 155)).toBe(
      "Homes in Paldi median ₹1.85 Cr a note",
    );
    // A part that does not fit is dropped, not truncated into it.
    expect(composeSerpText(["Homes in Paldi", "median ₹1.85 Cr"], 20)).toBe("Homes in Paldi");
  });

  /* Stopping at the first part that does not fit is deliberate. Keeping going
     produced a listing page titled "— ₹11,000 / mo": the subject overflowed,
     so the price was emitted with nothing it referred to. */
  it("stops at the first part that does not fit", () => {
    expect(composeSerpText(["Base", "x".repeat(100), "Short."], 20)).toBe("Base");
  });

  it("keeps the first part even when it overflows, for fitSerpText to trim", () => {
    // Without this the subject could be dropped and a lone clause published.
    expect(composeSerpText(["x".repeat(100), "Short."], 20)).toBe("x".repeat(100));
    expect(fitSerpText(composeSerpText(["x".repeat(100), "Short."], 20), 20).length).toBeLessThanOrEqual(20);
  });

  it("skips empty and false parts", () => {
    expect(composeSerpText(["Base", "", null, undefined, false, "Tail"], 40)).toBe("Base Tail");
  });

  it("truncates on a word boundary only as a last resort", () => {
    expect(fitSerpText("Short enough", 60)).toBe("Short enough");
    expect(isSerpTruncated(fitSerpText("Short enough", 60))).toBe(false);
    const cut = fitSerpText("A very long sentence that has to be cut down somewhere", 20);
    expect(cut.length).toBeLessThanOrEqual(20);
    expect(cut.endsWith(SERP_ELLIPSIS)).toBe(true);
    expect(cut).not.toMatch(/\s…$/);
  });
});

describe("every listing fits the budget without truncation", () => {
  const listings = getListings();

  it("has listings to check", () => {
    expect(listings.length).toBeGreaterThan(0);
  });

  it("renders every listing title within the SERP limit", () => {
    for (const property of listings) {
      const title = listingSerpTitle(property);
      expect(renderedTitle(title), `${property.id}: ${title}`).toBeLessThanOrEqual(SERP_TITLE_MAX);
    }
  });

  it("renders every listing description within the SERP limit", () => {
    for (const property of listings) {
      const description = listingSerpDescription(property);
      expect(description.length, `${property.id}: ${description}`).toBeLessThanOrEqual(SERP_DESCRIPTION_MAX);
    }
  });

  /* The quality gate: the budget holding is guaranteed by truncation, so this
     is the test that can actually fail. If a listing note grows, CI fails and
     the copy is rewritten rather than silently ellipsised in the SERP. */
  it("never needs to truncate a listing title or description", () => {
    for (const property of listings) {
      expect(isSerpTruncated(listingSerpTitle(property)), property.id).toBe(false);
      expect(isSerpTruncated(listingSerpDescription(property)), property.id).toBe(false);
    }
  });

  /* C's answer-first rule: the number a searcher is looking for belongs at the
     front of the snippet, where truncation cannot take it. */
  it("leads the description with configuration, area, place and price", () => {
    for (const property of listings.slice(0, 40)) {
      const description = listingSerpDescription(property);
      expect(description.startsWith(property.meta)).toBe(true);
      expect(description).toContain(property.locality);
      expect(description).toContain(property.price);
    }
  });

  it("falls back to a formula when the editorial title cannot fit", () => {
    // The longest generated titles are longer than the whole budget.
    const longest = [...listings].sort((a, b) => b.title.length - a.title.length)[0];
    const title = listingSerpTitle(longest);
    expect(renderedTitle(title)).toBeLessThanOrEqual(SERP_TITLE_MAX);
    expect(title).toContain(`${longest.bhk} BHK`);
    expect(title).toContain(longest.locality);
  });
});

describe("every locality and city fits the budget without truncation", () => {
  const localities = getLocalities();

  it("has localities to check", () => {
    expect(localities.length).toBeGreaterThan(0);
  });

  it("renders every locality title within the SERP limit", () => {
    for (const locality of localities) {
      const city = getCities().find((entry) => entry.slug === locality.citySlug);
      expect(city).toBeDefined();
      const title = localitySerpTitle({ name: locality.name, cityName: city!.name });
      expect(renderedTitle(title), `${locality.slug}: ${title}`).toBeLessThanOrEqual(SERP_TITLE_MAX);
    }
  });

  it("renders every locality description within the SERP limit", () => {
    for (const locality of localities) {
      const city = getCities().find((entry) => entry.slug === locality.citySlug)!;
      const input = {
        name: locality.name,
        note: locality.note,
        pincodes: locality.pincodes,
        cityName: city.name,
        reraAuthority: city.reraAuthority,
        intel: localityIntel(locality.slug),
      };
      const description = localitySerpDescription(input);
      expect(description.length, `${locality.slug}: ${description}`).toBeLessThanOrEqual(SERP_DESCRIPTION_MAX);
      expect(isSerpTruncated(description), locality.slug).toBe(false);
    }
  });

  it("never truncates a locality title", () => {
    for (const locality of localities) {
      const city = getCities().find((entry) => entry.slug === locality.citySlug)!;
      expect(isSerpTruncated(localitySerpTitle({ name: locality.name, cityName: city.name })), locality.slug).toBe(false);
    }
  });

  /* The answer-first rule again: where the sample supports a median it is
     printed ahead of the boilerplate; where it does not, no median appears at
     all rather than one dressed up as a market figure. */
  it("prints the median only where the sample supports it", () => {
    for (const locality of localities) {
      const intel = localityIntel(locality.slug);
      const description = localitySerpDescription({
        name: locality.name,
        note: locality.note,
        pincodes: locality.pincodes,
        cityName: "City",
        reraAuthority: "State RERA",
        intel,
      });
      if (intel.sampleSufficient && intel.medianPriceInr !== null) {
        expect(description).toContain("Median");
      } else {
        expect(description).not.toContain("Median");
      }
    }
  });

  it("renders every city title and description within the SERP limit", () => {
    for (const city of getCities()) {
      const title = citySerpTitle(city);
      expect(renderedTitle(title), `${city.slug}: ${title}`).toBeLessThanOrEqual(SERP_TITLE_MAX);
      expect(isSerpTruncated(title), city.slug).toBe(false);
      const description = citySerpDescription({ ...city, localities: getLocalities(city.slug).map((l) => l.name) });
      expect(description.length, `${city.slug}: ${description}`).toBeLessThanOrEqual(SERP_DESCRIPTION_MAX);
      expect(isSerpTruncated(description), city.slug).toBe(false);
    }
  });
});
