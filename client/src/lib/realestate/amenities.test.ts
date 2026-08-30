/* Amenity-category contract.

   The regression this file exists to prevent: the category was previously
   inferred from the place name, and the inference was wrong for 11 of the 30
   places in the registry — "EON IT Park" matched `park` and rendered as
   *Green* on the locality page, and "IIT Bombay" rendered as *Landmark*
   because the rule listed `iim` and not `iit`.

   So the tests split along the same seam as the implementation: inference is
   tested against the names it demonstrably got wrong, and the shipped corpus
   is tested on the stronger claim that it does not rely on inference at all. */
import { describe, expect, it } from "vitest";
import { getLocalities } from "@/lib/repositories";
import {
  AMENITY_CATEGORIES,
  AMENITY_LABELS,
  categorizeAmenity,
  inferAmenityCategory,
  isAmenityCategory,
  normalizeAmenities,
  type AmenityRow,
} from "./amenities";

describe("amenity inference", () => {
  /* Each row is a place whose category the old name-sniffing rules got wrong,
     or that a naive rule set gets wrong. They are the reason the inference
     rules are ordered the way they are. */
  const cases: [string, ReturnType<typeof inferAmenityCategory>][] = [
    // An employment hub must not be read as a park: "EON IT Park" contains "park".
    ["EON IT Park", "work"],
    ["ITPL", "work"],
    ["Financial District", "work"],
    ["Infopark Kochi", "work"],
    // `iim` was in the old rule and `iit` was not, so one IIT was a landmark.
    ["IIT Bombay", "learning"],
    ["IIM Ahmedabad", "learning"],
    // A rail terminus is transit, not a landmark.
    ["Bandra Terminus", "transit"],
    ["Bandra–Worli Sea Link", "transit"],
    ["100 Feet Road", "transit"],
    // Names the old rules collapsed to "Landmark" despite having a clear kind.
    ["Select Citywalk", "retail"],
    ["Gachibowli Stadium", "sports"],
    ["Qutub Minar", "culture"],
    // Names the old rules got right, pinned so a rule reorder cannot regress them.
    ["Law Garden", "green"],
    ["Powai Lake", "green"],
    ["SVP Airport", "transit"],
    ["Tagore Hall", "culture"],
  ];

  it.each(cases)("infers %s as %s", (name, expected) => {
    expect(inferAmenityCategory(name)).toBe(expected);
  });

  it("falls back to landmark for a name matching no rule", () => {
    expect(inferAmenityCategory("Some Unrecognised Place")).toBe("landmark");
  });
});

describe("amenity category resolution", () => {
  it("prefers the declared category over what the name suggests", () => {
    // "Hiranandani Gardens" would infer to green; the registry declares it a
    // landmark because it is a township, not a public park.
    expect(inferAmenityCategory("Hiranandani Gardens")).toBe("green");
    expect(categorizeAmenity("Hiranandani Gardens", "landmark")).toBe("landmark");
  });

  /* The declared value arrives as JSON from the database, so an unrecognised
     value must degrade to inference rather than be emitted as a category no
     consumer can label. */
  it("ignores a declared category that is not in the vocabulary", () => {
    expect(categorizeAmenity("EON IT Park", "park")).toBe("work");
    expect(categorizeAmenity("EON IT Park", 42)).toBe("work");
    expect(categorizeAmenity("EON IT Park", undefined)).toBe("work");
  });

  it("recognises exactly the published vocabulary", () => {
    for (const category of AMENITY_CATEGORIES) expect(isAmenityCategory(category)).toBe(true);
    expect(isAmenityCategory("park")).toBe(false);
    expect(isAmenityCategory("")).toBe(false);
    expect(isAmenityCategory(undefined)).toBe(false);
  });

  it("labels every category", () => {
    for (const category of AMENITY_CATEGORIES) {
      expect(AMENITY_LABELS[category]).toBeTruthy();
    }
    expect(Object.keys(AMENITY_LABELS).sort()).toEqual([...AMENITY_CATEGORIES].sort());
  });
});

describe("amenity normalisation", () => {
  it("types a declared row and preserves the author's distance string", () => {
    expect(normalizeAmenities([["Law Garden", "≈ 1.4 km", "green"]])).toEqual([
      { name: "Law Garden", distance: "≈ 1.4 km", category: "green" },
    ]);
  });

  it("falls back to inference for a legacy two-element row", () => {
    expect(normalizeAmenities([["EON IT Park", "≈ 1.3 km"]])).toEqual([
      { name: "EON IT Park", distance: "≈ 1.3 km", category: "work" },
    ]);
  });

  /* A JSON column predates this typing, so a bad row must be dropped rather
     than throw — one corrupt amenity cannot take a locality page down. */
  it("drops malformed rows instead of throwing", () => {
    expect(normalizeAmenities([["Only name"], [1, 2], "not a row", null, []])).toBeUndefined();
    expect(normalizeAmenities([["", "≈ 1 km"]])).toBeUndefined();
    expect(normalizeAmenities([["Name", ""]])).toBeUndefined();
    expect(normalizeAmenities([["Keep", "≈ 1 km", "green"], ["drop"]])).toEqual([
      { name: "Keep", distance: "≈ 1 km", category: "green" },
    ]);
  });

  it("returns undefined for input that is not a list", () => {
    expect(normalizeAmenities(undefined)).toBeUndefined();
    expect(normalizeAmenities(null)).toBeUndefined();
    expect(normalizeAmenities({})).toBeUndefined();
    expect(normalizeAmenities([])).toBeUndefined();
  });
});

describe("shipped amenity corpus", () => {
  const localitiesWithLandmarks = getLocalities().filter((locality) => (locality.landmarks ?? []).length > 0);

  it("has landmarks to check", () => {
    expect(localitiesWithLandmarks.length).toBeGreaterThan(0);
  });

  /* The gate that stops the original bug from returning. Every landmark in the
     registry must state its own category, so adding a place cannot silently
     publish a guessed label — CI fails until the author says what it is.
     Inference survives only for database rows that predate the field. */
  it("declares a category for every landmark rather than relying on inference", () => {
    const inferred: string[] = [];
    for (const locality of localitiesWithLandmarks) {
      for (const row of (locality.landmarks ?? []) as AmenityRow[]) {
        if (!isAmenityCategory(row[2])) inferred.push(`${locality.slug}: ${row[0]}`);
      }
    }
    expect(inferred).toEqual([]);
  });

  it("only ever declares categories from the published vocabulary", () => {
    for (const locality of localitiesWithLandmarks) {
      for (const row of (locality.landmarks ?? []) as AmenityRow[]) {
        expect(isAmenityCategory(row[2])).toBe(true);
      }
    }
  });
});
