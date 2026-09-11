import { describe, expect, it } from "vitest";
import {
  activeFacetCount,
  applyFacetState,
  buildHistogram,
  computeFacetCounts,
  computeRelaxations,
  emptyFacetState,
  facetGroups,
  formatIndianRupees,
  groupsForProjection,
  isFacetStateEmpty,
  parseFacetState,
  resolveValues,
  roundUpTo,
  serializeFacetState,
  wideningSuggestions,
  type FacetGroup,
} from "./facets";
import { parseFilterParam } from "@/lib/filters";
import type { Property } from "@/lib/properties";

/* ---------- Fixtures ----------
   Hand-built so a facet regression points at a predicate, not at the
   generator. Covers the shapes that break naive filter code: an unsatisfiable
   cross-group pair, a rent listing on a monthly scale, and a listing whose
   freshness label is unparseable. */

const base = {
  city: "Ahmedabad",
  citySlug: "ahmedabad",
  pricePerSqft: "₹12,000 / sq ft",
  transaction: "buy",
  category: "residential",
  subtype: "Flat/Apartment",
  project: "Test Project",
  developer: "Test Dev",
  image: "prop-light",
  badge: "Source reviewed",
  status: "Updated 4 days ago",
  note: "",
  details: {},
} as const;

function listing(over: Partial<Property> & Pick<Property, "id">): Property {
  return {
    title: over.id,
    locality: "Paldi",
    localitySlug: "paldi",
    price: "₹1 Cr",
    priceNum: 10_000_000,
    meta: "2 BHK",
    bhk: 2,
    area: "1,000 sq ft",
    areaNum: 1000,
    propertyType: "APARTMENT",
    availability: "READY_TO_MOVE",
    ...base,
    ...over,
  } as Property;
}

const inventory: Property[] = [
  listing({ id: "a", locality: "Paldi", localitySlug: "paldi", bhk: 2, priceNum: 9_000_000, badge: "RERA verified", status: "Updated today" }),
  listing({ id: "b", locality: "Paldi", localitySlug: "paldi", bhk: 3, priceNum: 14_000_000, propertyType: "VILLA", availability: "RESALE", status: "Updated 3 days ago", areaNum: 1800 }),
  listing({ id: "c", locality: "Thaltej", localitySlug: "thaltej", bhk: 4, priceNum: 24_000_000, availability: "NEW_LAUNCH", status: "Updated 9 days ago", areaNum: 2200, gallery: ["prop-courtyard", "prop-light", "prop-thaltej", "stepwell", "brick-arch"] }),
  listing({ id: "d", locality: "Thaltej", localitySlug: "thaltej", bhk: 5, priceNum: 41_000_000, propertyType: "VILLA", badge: "RERA verified", status: "Updated 40 days ago", areaNum: 4000 }),
  // A low-value BUY listing, so the ₹10 L control floor is exercised against
  // real inventory instead of being assumed.
  listing({ id: "f", locality: "Bopal", localitySlug: "bopal", bhk: 1, priceNum: 2_200_000, propertyType: "PLOT", category: "plot", status: "brand new, no stamp" }),
  // A genuine monthly rent. The facet engine is transaction-agnostic — market
  // scope is `applyMarket`'s job — so this proves the range control works at a
  // scale the BUY domain could not express.
  listing({ id: "e", locality: "Bopal", localitySlug: "bopal", bhk: 2, priceNum: 22_000, price: "₹22,000 / mo", transaction: "rent", status: "Updated today" }),
];

const buy = facetGroups({ intent: "buy" });
const consumer = groupsForProjection(buy, "consumer");

const ids = (list: Property[]) => list.map((property) => property.id).sort();
const stateOf = (raw: string, groups: FacetGroup[] = buy) => parseFacetState(raw, groups);

describe("group semantics: OR within, AND across", () => {
  it("ORs values inside one group (the bug that returned an empty page)", () => {
    expect(ids(applyFacetState(inventory, stateOf("bhk:2,bhk:3"), buy))).toEqual(["a", "b", "e"]);
    // Previously `2bhk` + `3bhk+` were two independent AND predicates → zero.
    // Now: 2 ∪ 3 ∪ 4 = a, b, c, e.
    expect(ids(applyFacetState(inventory, stateOf("bhk:2,bhk:3,bhk:4"), buy))).toEqual(["a", "b", "c", "e"]);
  });

  it("ANDs across groups", () => {
    expect(ids(applyFacetState(inventory, stateOf("bhk:2,place:thaltej"), buy))).toEqual([]);
    expect(ids(applyFacetState(inventory, stateOf("bhk:4,place:thaltej"), buy))).toEqual(["c"]);
  });

  it("ignores an empty state entirely rather than filtering everything out", () => {
    expect(applyFacetState(inventory, emptyFacetState(), buy)).toHaveLength(inventory.length);
    expect(isFacetStateEmpty(emptyFacetState())).toBe(true);
  });

  it("treats a selected id with no matching value as no constraint", () => {
    expect(applyFacetState(inventory, stateOf("bhk:99"), buy)).toHaveLength(inventory.length);
  });
});

describe("range facets", () => {
  it("treats the full domain as inactive so it never renders a phantom chip", () => {
    const group = buy.find((entry) => entry.id === "price")!;
    const state = stateOf(`price:${group.range!.min}-${group.range!.max}`);
    expect(state.ranges.price).toBeUndefined();
    expect(isFacetStateEmpty(state)).toBe(true);
  });

  it("clamps a control domain rather than trusting a pasted range", () => {
    const rent = facetGroups({ intent: "rent" });
    // A BUY budget pasted into a RENT search: both ends land on the ₹3 L rent
    // ceiling. Each end is clamped INTO the domain — the crucial part is that
    // `from` is NOT pushed up from the floor, which would silently widen the
    // constraint to "everything" and return the whole market.
    expect(parseFacetState("price:1500000-3000000", rent).ranges.price).toEqual({ from: 300_000, to: 300_000 });
    expect(applyFacetState(inventory, parseFacetState("price:1500000-3000000", rent), rent)).toHaveLength(0);
    // A rent-shaped budget matches on value alone; the engine is deliberately
    // transaction-agnostic (`applyMarket` owns that split, so the two can never
    // overlap and double-filter). ₹15k–₹25k/month finds the rental only.
    expect(ids(applyFacetState(inventory, parseFacetState("price:15000-25000", rent), rent))).toEqual(["e"]);
    // A range below the floor clamps up to it rather than vanishing.
    expect(parseFacetState("price:1-999", rent).ranges.price).toEqual({ from: 5_000, to: 5_000 });
  });
});

describe("back-compat with the pre-rebuild URL contract", () => {
  it("maps every legacy chip id onto a group", () => {
    const legacy = ["2bhk", "under15", "rera", "type-villa", "availability-resale"];
    expect(parseFilterParam(legacy.join(","))).toEqual(legacy); // survives the URL guard
    const state = stateOf(legacy.join(","));
    expect(state.multi.bhk).toEqual(["2"]);
    expect(state.multi.trust).toEqual(["rera"]);
    expect(state.multi.type).toEqual(["villa"]);
    expect(state.multi.status).toEqual(["resale"]);
    expect(state.ranges.price?.to).toBe(15_000_000);
  });

  it("keeps option ids containing '+' intact through the comma grammar", () => {
    // `5+` is a real option id and the delimiter is a comma; a `+` must never be
    // treated as a modifier. This is what silently-zeroed the case before.
    expect(stateOf("bhk:5+").multi.bhk).toEqual(["5+"]);
    expect(ids(applyFacetState(inventory, stateOf("bhk:5+"), buy))).toEqual(["d"]);
    expect(stateOf("bhk:9").multi.bhk).toBeUndefined(); // unknown id → no constraint
  });

  it("drops unknown bare tokens but keeps grouped ones", () => {
    expect(stateOf("hacker,place:paldi,alsobad").multi.place).toEqual(["paldi"]);
  });

  it("round-trips through the URL serialiser in canonical form", () => {
    const raw = "place:thaltej,bhk:3,type:villa,price:5000000-25000000";
    // `price` re-serialises from its clamped bounds, which for an open lower
    // end is the control minimum — canonical, and stable on a second pass.
    const canonical = "place:thaltej,bhk:3,type:villa,price:5000000-25000000";
    expect(serializeFacetState(stateOf(raw))).toBe(canonical);
    const once = stateOf(serializeFacetState(stateOf(raw)));
    expect(serializeFacetState(once)).toBe(canonical);
    expect(stateOf(canonical)).toEqual(once);
  });
});

describe("counts are honest", () => {
  it("counts with the counted group's own predicate removed", () => {
    // With Thaltej active, bhk options must count *within Thaltej* …
    const counts = computeFacetCounts(inventory, stateOf("place:thaltej"), buy).bhk.options;
    expect(counts.find((option) => option.id === "4")?.count).toBe(1);
    expect(counts.find((option) => option.id === "2")?.count).toBe(0);
    // … and selecting one of them must not be offered as if it widened nothing.
    expect(applyFacetState(inventory, stateOf("place:thaltej,bhk:4"), buy)).toHaveLength(1);
  });

  it("keeps (0) visible for a fixed-list group, and refines a derived group", () => {
    // A (0) on `bhk` is information about the OPTION ("no 5 BHK here"), so it
    // must stay visible and disabled. A (0) on `place` is information about the
    // INTERSECTION, and 40 zero rows is noise — so locality options refine.
    const bhkCounts = computeFacetCounts(inventory, stateOf("place:bopal"), buy).bhk.options;
    expect(bhkCounts.find((option) => option.id === "3")?.count).toBe(0);
    expect(bhkCounts).toHaveLength(5); // nothing hidden
    const placeCounts = computeFacetCounts(inventory, stateOf("bhk:5+"), buy).place.options;
    expect(placeCounts).toEqual([{ id: "thaltej", label: "Thaltej", count: 1, selected: false }]);
    // and the count is a promise, not decoration:
    expect(applyFacetState(inventory, stateOf("bhk:5+,place:bopal"), buy)).toHaveLength(0);
  });

  it("labels derived options from inventory, never from a slug guess", () => {
    const values = resolveValues(buy.find((group) => group.id === "place")!, inventory);
    expect(values.map((value) => value.label)).toEqual(["Bopal", "Paldi", "Thaltej"]);
    expect(values.every((value) => value.count === 2)).toBe(true); // two per locality
  });

  it("counts the verified toggle as what it EXCLUDES, not the whole market", () => {
    expect(computeFacetCounts(inventory, emptyFacetState(), buy).trust.options[0].count).toBe(2);
  });
});

describe("recency only claims what the label supports", () => {
  it("buckets days and weeks, and never includes an unparseable stamp", () => {
    const state = stateOf("fresh:7d");
    expect(ids(applyFacetState(inventory, state, buy))).toEqual(["a", "b", "e"]);
    // e says "Updated today", which is a claim the label does support.
    expect(ids(applyFacetState(inventory, stateOf("fresh:30d"), buy))).toEqual(["a", "b", "c", "e"]);
    // f's "brand new, no stamp" is NOT treated as recent. Over-reporting
    // freshness is the one error a trust-branded product cannot make, so an
    // unparseable label is excluded rather than assumed new.
    expect(ids(applyFacetState(inventory, stateOf("fresh:30d"), buy))).not.toContain("f");
    expect(ids(applyFacetState(inventory, stateOf("fresh:1d"), buy))).toEqual(["a", "e"]);
  });
});

describe("budget formatting is Indian-first", () => {
  it("uses Cr above 1 crore and L below, with no long digit runs", () => {
    expect(formatIndianRupees(14_000_000)).toBe("₹1.4 Cr");
    expect(formatIndianRupees(9_800_000)).toBe("₹98 L");
    expect(formatIndianRupees(2_200_000)).toBe("₹22 L");
    expect(formatIndianRupees(0)).toBe("—");
  });

  it("rounds bucket widths to readable multiples", () => {
    expect(roundUpTo(2_347_611, 1_000_000)).toBe(3_000_000);
    expect(roundUpTo(1_234, 50)).toBe(1250);
    expect(roundUpTo(-5, 1000)).toBe(0);
  });
});

describe("price histogram", () => {
  const range = facetGroups({ intent: "buy" }).find((group) => group.id === "price")!.range!;

  it("bounds the domain at p95 so a single outlier cannot squash the axis", () => {
    const skewed = [1_000_000, 1_100_000, 1_200_000, 1_300_000, 2_000_000, 58_000_000];
    const histogram = buildHistogram(skewed, range, 10);
    expect(histogram.p95).toBeLessThan(58_000_000);
    expect(histogram.ceil).toBeLessThan(58_000_000); // domain ends near p95, not at the max
    expect(histogram.ceil).toBeGreaterThanOrEqual(histogram.p95);
    expect(histogram.buckets.length).toBeGreaterThan(1);
    expect(histogram.total).toBe(6); // the outlier is still in the population
    expect(histogram.max).toBeGreaterThan(0);
  });

  it("is total-safe on empty and single-value input", () => {
    expect(buildHistogram([], range).buckets.every((bucket) => bucket.count === 0)).toBe(true);
    expect(buildHistogram([9_000_000], range).total).toBe(1);
  });

  it("never returns more buckets than the cap", () => {
    const wide = Array.from({ length: 400 }, (_, index) => 1_000_000 + index * 100_000);
    expect(buildHistogram(wide, range, 12).buckets.length).toBeLessThanOrEqual(12);
  });
});

describe("zero-result ladder", () => {
  it("relaxes the single constraint that costs the most results", () => {
    const state = stateOf("bhk:5+,place:paldi");
    expect(applyFacetState(inventory, state, buy)).toHaveLength(0); // genuinely impossible
    const relaxations = computeRelaxations(inventory, state, buy);
    expect(relaxations.map((relaxation) => relaxation.gain).sort()).toEqual([1, 2]);
    // Ranked by gain, and the first one is exactly the suggestion worth making:
    // dropping the 5-BHK requirement returns more than dropping Paldi.
    expect(relaxations[0].groupId).toBe("bhk");
    expect(applyFacetState(inventory, relaxations[0].state, buy)).toHaveLength(2);
    expect(relaxations[0].gain).toBe(2); // from 0 → 2
  });

  it("suggests only localities that actually have inventory", () => {
    const widening = wideningSuggestions(inventory, stateOf("bhk:5+,place:bopal"), buy);
    expect(widening.map((value) => value.id)).toContain("thaltej"); // d is the only 5+ BHK
    expect(widening.map((value) => value.id)).not.toContain("bopal"); // already active
    expect(widening.every((value) => (value.count ?? 0) > 0)).toBe(true);
  });

  it("counts an applied range as one constraint, not zero", () => {
    expect(activeFacetCount(stateOf("price:5000000-25000000"))).toBe(1);
    expect(activeFacetCount(stateOf("price:5000000-25000000,bhk:2,bhk:3"))).toBe(3);
  });
});

describe("one schema, two audiences", () => {
  it("keeps buyer-visible groups minimal", () => {
    expect(consumer.map((group) => group.id)).toEqual(expect.arrayContaining(["place", "price", "bhk", "type", "status", "trust"]));
    expect(consumer.map((group) => group.id)).not.toContain("furnishing");
    expect(consumer.map((group) => group.id)).not.toContain("area");
  });

  it("gives the desk every group including the blocked ones", () => {
    const desk = groupsForProjection(buy, "desk");
    expect(desk.map((group) => group.id)).toEqual(expect.arrayContaining(["furnishing", "area", "media", "fresh"]));
    expect(desk.length).toBeGreaterThan(consumer.length);
  });

  it("projects a group only when it is declared for it", () => {
    const furnishing = buy.find((group) => group.id === "furnishing")!;
    expect(furnishing.projection).toEqual(["desk"]);
    const state = parseFacetState("furnishing:furnished", buy);
    expect(state.multi.furnishing).toEqual(["furnished"]);
  });
});
