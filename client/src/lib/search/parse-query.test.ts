import { describe, expect, it } from "vitest";
import {
  applyParsedQueryToParams,
  describeParsedQuery,
  formatBudget,
  parseSearchQuery,
  parsedQueryToSearchUrl,
  residualQueryText,
} from "./parse-query";

describe("structured query parsing", () => {
  it("reads BHK, budget, locality and city out of one sentence", () => {
    const parsed = parseSearchQuery("3 bhk in koramangala under 2 cr");
    expect(parsed.bhk).toBe(3);
    expect(parsed.maxPriceInr).toBe(20_000_000);
    expect(parsed.localities.map((l) => l.slug)).toEqual(["koramangala"]);
    expect(parsed.city?.slug).toBe("bengaluru");
    expect(parsed.understood).toBe(true);
  });

  it("handles lakh, decimal crore and 'below' phrasing", () => {
    expect(parseSearchQuery("under 80 lakh").maxPriceInr).toBe(8_000_000);
    expect(parseSearchQuery("below 1.5 cr").maxPriceInr).toBe(15_000_000);
    expect(parseSearchQuery("flats upto ₹95 lakh").maxPriceInr).toBe(9_500_000);
  });

  it("does not mistake a budget for a bedroom count", () => {
    const parsed = parseSearchQuery("under 3 cr");
    expect(parsed.maxPriceInr).toBe(30_000_000);
    expect(parsed.bhk).toBeUndefined();
  });

  it("recognises rent intent and commercial category", () => {
    const rent = parseSearchQuery("rent 2 bhk in wakad");
    expect(rent.intent).toBe("rent");
    expect(rent.bhk).toBe(2);
    expect(rent.localities.map((l) => l.slug)).toEqual(["wakad"]);

    const office = parseSearchQuery("office space in gachibowli");
    expect(office.category).toBe("commercial");
    expect(office.city?.slug).toBe("hyderabad");
  });

  it("maps spoken phrases onto real filter ids", () => {
    expect(parseSearchQuery("ready to move villa in thaltej").filters).toEqual(
      expect.arrayContaining(["availability-ready", "type-villa"]),
    );
    expect(parseSearchQuery("rera verified homes").filters).toContain("rera");
    expect(parseSearchQuery("new launch in hinjawadi").filters).toContain("availability-new");
    expect(parseSearchQuery("2 bhk").filters).toContain("2bhk");
    expect(parseSearchQuery("4 bhk").filters).toContain("3bhk");
  });

  it("resolves a PIN to its city and localities", () => {
    const parsed = parseSearchQuery("2 bhk 411057");
    expect(parsed.pincode).toBe("411057");
    expect(parsed.city?.slug).toBe("pune");
    expect(parsed.localities.map((l) => l.slug).sort()).toEqual(["hinjawadi", "wakad"]);
  });

  it("matches multi-word locality names over their individual words", () => {
    expect(parseSearchQuery("prahlad nagar").localities.map((l) => l.slug)).toEqual(["prahlad-nagar"]);
    expect(parseSearchQuery("hsr layout").localities.map((l) => l.slug)).toEqual(["hsr-layout"]);
    expect(parseSearchQuery("salt lake sector v").localities.map((l) => l.slug)).toEqual(["salt-lake-sector-v"]);
  });

  it("matches a Devanagari place name", () => {
    expect(parseSearchQuery("पालडी").localities.map((l) => l.slug)).toEqual(["paldi"]);
  });

  it("takes the city from an explicit city name over the ambient scope", () => {
    expect(parseSearchQuery("homes in jaipur", "mumbai").city?.slug).toBe("jaipur");
  });

  it("falls back to the ambient scope when no place is named", () => {
    expect(parseSearchQuery("3 bhk", "kolkata").city?.slug).toBe("kolkata");
  });

  it("understands nothing in genuine nonsense, and says so", () => {
    const parsed = parseSearchQuery("qwerty zzzz");
    expect(parsed.understood).toBe(false);
    expect(parsed.city).toBeUndefined();
    expect(parsed.localities).toEqual([]);
    expect(parsed.residual).toBe("qwerty zzzz");
  });

  it("does not let a short token drag in an unrelated place", () => {
    // "pal" is an exact locality in Surat but must not match "Paldi"/"Piplod".
    expect(parseSearchQuery("pal").localities.map((l) => l.slug)).toEqual(["pal"]);
  });
});

describe("lossless rewriting into URL parameters", () => {
  it("keeps locality names in q because no parameter can carry them", () => {
    const parsed = parseSearchQuery("3 bhk in whitefield");
    expect(residualQueryText(parsed)).toContain("Whitefield");
    const params = applyParsedQueryToParams(parsed);
    expect(params.get("city")).toBe("bengaluru");
    expect(params.get("q")).toContain("Whitefield");
    expect(params.get("filters")).toContain("3bhk");
  });

  it("keeps a budget the filter vocabulary cannot express", () => {
    // ₹2 Cr is above the only price filter (under ₹1.5 Cr), so it must survive
    // as free text rather than being silently dropped.
    const parsed = parseSearchQuery("3 bhk under 2 cr in powai");
    expect(parsed.filters).not.toContain("under15");
    expect(residualQueryText(parsed)).toContain("under 2 cr");
  });

  it("drops a budget from q once a filter represents it", () => {
    const parsed = parseSearchQuery("2 bhk under 1 cr in adajan");
    expect(parsed.filters).toContain("under15");
    expect(residualQueryText(parsed)).not.toContain("under");
  });

  it("preserves filters already selected when merging", () => {
    const base = new URLSearchParams("filters=rera&sort=price-asc");
    const params = applyParsedQueryToParams(parseSearchQuery("2 bhk in vesu"), base);
    expect(params.get("filters")?.split(",").sort()).toEqual(["2bhk", "rera"]);
    expect(params.get("sort")).toBe("price-asc");
  });

  it("builds a canonical trailing-slash search URL", () => {
    const url = parsedQueryToSearchUrl(parseSearchQuery("rent in bandra west"));
    expect(url.startsWith("/search/?")).toBe(true);
    expect(url).toContain("intent=rent");
    expect(url).toContain("city=mumbai");
  });

  it("never AND-s two locality names into q, which would match nothing", () => {
    // 411057 covers Hinjawadi and Wakad; the PIN parameter already ORs them.
    const parsed = parseSearchQuery("rent 2bhk 411057");
    expect(parsed.localities).toHaveLength(2);
    const params = applyParsedQueryToParams(parsed);
    expect(params.get("q")).toBeNull();
    expect(params.get("pincode")).toBe("411057");
    expect(params.get("intent")).toBe("rent");
  });

  it("carries a PIN through as its own parameter", () => {
    expect(parsedQueryToSearchUrl(parseSearchQuery("395007"))).toContain("pincode=395007");
  });
});

describe("explaining the query back to the reader", () => {
  it("describes the parsed scope in plain words", () => {
    const description = describeParsedQuery(parseSearchQuery("3 bhk villa in thaltej under 3 cr rera"));
    expect(description).toContain("3 BHK");
    expect(description).toContain("villa");
    expect(description).toContain("in Thaltej");
    expect(description).toContain("under ₹3 Cr");
    expect(description).toContain("RERA verified");
  });

  it("formats rupees the way the rest of the product does", () => {
    expect(formatBudget(15_000_000)).toBe("₹1.5 Cr");
    expect(formatBudget(20_000_000)).toBe("₹2 Cr");
    expect(formatBudget(8_000_000)).toBe("₹80 L");
  });

  it("is deterministic", () => {
    expect(parseSearchQuery("2 bhk in vesu")).toEqual(parseSearchQuery("2 bhk in vesu"));
  });
});
