import { describe, expect, it } from "vitest";
import { applyFilters, applyQuery, applySort, makeFilters, parseFilterParam, serializeFilters } from "./filters";

const fixtures = [
  { id: "a", bhk: 3, priceNum: 18_500_000, badge: "RERA verified" },
  { id: "b", bhk: 2, priceNum: 12_400_000, badge: "Verified partner" },
  { id: "c", bhk: 4, priceNum: 24_000_000, badge: "RERA verified" },
  { id: "d", bhk: 2, priceNum: 9_800_000, badge: "Source reviewed" },
];

describe("applyFilters", () => {
  it("returns everything when no filters are active", () => {
    expect(applyFilters(fixtures, [])).toHaveLength(4);
  });

  it("filters by a single criterion", () => {
    const out = applyFilters(fixtures, ["2bhk"]);
    expect(out.map((p) => p.id)).toEqual(["b", "d"]);
  });

  it("AND-combines multiple filters", () => {
    const out = applyFilters(fixtures, ["2bhk", "under15"]);
    expect(out.map((p) => p.id)).toEqual(["b", "d"]);
    const strict = applyFilters(fixtures, ["2bhk", "rera"]);
    expect(strict).toHaveLength(0);
  });
});

describe("applySort", () => {
  it("sorts by price ascending and descending", () => {
    expect(applySort(fixtures, "price-asc")[0].id).toBe("d");
    expect(applySort(fixtures, "price-desc")[0].id).toBe("c");
  });
  it("keeps fixture order for freshness", () => {
    expect(applySort(fixtures, "fresh").map((p) => p.id)).toEqual(["a", "b", "c", "d"]);
  });
});

describe("URL round-trip", () => {
  it("serializes and parses filter ids, dropping unknown ones", () => {
    const ids = ["2bhk", "rera"];
    expect(parseFilterParam(serializeFilters(ids))).toEqual(ids);
    expect(parseFilterParam("2bhk,hacker,rera")).toEqual(["2bhk", "rera"]);
    expect(parseFilterParam(null)).toEqual([]);
  });
  it("validates against real filter definitions", () => {
    const validIds = makeFilters().map((f) => f.id);
    expect(validIds).toContain("under15");
  });
});

describe("matchesQuery (?q=)", () => {
  const homes = [
    { bhk: 3, locality: "Paldi", title: "A garden courtyard in Paldi", city: "Ahmedabad", priceNum: 18_500_000 },
    { bhk: 2, locality: "Prahlad Nagar", title: "Light across every room", city: "Ahmedabad", priceNum: 12_400_000 },
    { bhk: 4, locality: "Thaltej", title: "A quieter edge of Thaltej", city: "Ahmedabad", priceNum: 24_000_000 },
    { bhk: 2, locality: "Navrangpura", title: "Under the neem canopy", city: "Ahmedabad", priceNum: 9_800_000 },
  ];

  it("matches locality names case-insensitively", () => {
    expect(applyQuery(homes, "thaltej").map((p) => p.locality)).toEqual(["Thaltej"]);
    expect(applyQuery(homes, "PALDI")).toHaveLength(1);
  });

  it("understands BHK tokens", () => {
    expect(applyQuery(homes, "2 bhk")).toHaveLength(2);
    expect(applyQuery(homes, "2bhk navrangpura")).toHaveLength(1);
    expect(applyQuery(homes, "5 bhk")).toHaveLength(0);
  });

  it("understands price ceilings", () => {
    expect(applyQuery(homes, "under 1.5 cr")).toHaveLength(2);
    expect(applyQuery(homes, "under 1 cr")).toHaveLength(1);
  });

  it("ignores stop-words and empty queries", () => {
    expect(applyQuery(homes, "homes in Thaltej")).toHaveLength(1);
    expect(applyQuery(homes, "  ")).toHaveLength(4);
  });

  it("returns nothing for nonsense", () => {
    expect(applyQuery(homes, "mumbai bandra")).toHaveLength(0);
  });
});
