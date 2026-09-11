import { describe, expect, it } from "vitest";
import { cities, liveCities } from "./cities";
import { localities } from "./localities";
import {
  isValidPincode,
  knownPincodes,
  listingMatchesPincode,
  localitiesForPincode,
  parsePincode,
  pincodePrefix,
  pincodesForCity,
  resolvePincode,
} from "./pincodes";

describe("PIN validity", () => {
  it("accepts six digits that do not start with zero", () => {
    expect(isValidPincode("380007")).toBe(true);
    expect(isValidPincode(" 560066 ")).toBe(true);
  });

  it("rejects leading zeros, wrong lengths and non-digits", () => {
    expect(isValidPincode("012345")).toBe(false);
    expect(isValidPincode("38000")).toBe(false);
    expect(isValidPincode("3800077")).toBe(false);
    expect(isValidPincode("38O007")).toBe(false);
    expect(isValidPincode("")).toBe(false);
  });

  it("parses PINs out of spaced or hyphenated free text", () => {
    expect(parsePincode("380 007")).toBe("380007");
    expect(parsePincode("400-050")).toBe("400050");
    expect(parsePincode("2 bhk 560066")).toBe("560066");
    expect(parsePincode("no pin here")).toBeNull();
    expect(parsePincode(null)).toBeNull();
    expect(parsePincode(undefined)).toBeNull();
  });

  it("does not parse a PIN out of a longer digit run", () => {
    expect(parsePincode("12345678")).toBeNull();
  });

  it("exposes the three-digit postal sorting district", () => {
    expect(pincodePrefix("380007")).toBe("380");
  });
});

describe("PIN to locality is many-to-many", () => {
  it("returns every locality sharing one PIN", () => {
    const slugs = localitiesForPincode("395007").map((locality) => locality.slug).sort();
    expect(slugs).toEqual(["piplod", "vesu"]);
  });

  it("returns both Pune IT localities on 411057", () => {
    const slugs = localitiesForPincode("411057").map((locality) => locality.slug).sort();
    expect(slugs).toEqual(["hinjawadi", "wakad"]);
  });

  it("lets one locality claim several PINs", () => {
    const thaltej = localities.find((locality) => locality.slug === "thaltej");
    expect(thaltej?.pincodes).toEqual(["380059", "380054"]);
    expect(localitiesForPincode("380059").map((l) => l.slug)).toContain("thaltej");
    expect(localitiesForPincode("380054").map((l) => l.slug)).toContain("thaltej");
  });

  it("returns an empty list for an unknown or malformed PIN", () => {
    expect(localitiesForPincode("999999")).toEqual([]);
    expect(localitiesForPincode("abc")).toEqual([]);
  });
});

describe("resolvePincode", () => {
  it("resolves an exact PIN to its linked postal area", () => {
    const match = resolvePincode("560066");
    expect(match?.precision).toBe("postal-area");
    expect(match?.city?.slug).toBe("bengaluru");
    expect(match?.cities.map((city) => city.slug)).toEqual(["bengaluru"]);
    expect(match?.localities.map((locality) => locality.slug)).toEqual(["whitefield"]);
    expect(match?.ambiguous).toBe(false);
  });

  it("marks a PIN shared by product localities as ambiguous", () => {
    const match = resolvePincode("395007");
    expect(match?.localities.map((locality) => locality.slug).sort()).toEqual(["piplod", "vesu"]);
    expect(match?.ambiguous).toBe(true);
  });

  it("never infers a city from a three-digit sorting prefix", () => {
    // 400104 shares a Mumbai sorting prefix, but no exact fixture mapping. A
    // prefix is routing metadata, not proof that this PIN belongs to the city.
    expect(localitiesForPincode("400104")).toEqual([]);
    expect(resolvePincode("400104")).toBeNull();
  });

  it("refuses malformed and unknown exact PINs", () => {
    expect(resolvePincode("999999")).toBeNull();
    expect(resolvePincode("012345")).toBeNull();
    expect(resolvePincode("")).toBeNull();
  });
});

describe("registry coverage", () => {
  it("gives every locality at least one PIN", () => {
    const missing = localities.filter((locality) => locality.pincodes.length === 0);
    expect(missing.map((locality) => locality.slug)).toEqual([]);
  });

  it("only stores valid PINs", () => {
    const invalid = localities.flatMap((locality) =>
      locality.pincodes.filter((pincode) => !isValidPincode(pincode)).map((pincode) => `${locality.slug}:${pincode}`),
    );
    expect(invalid).toEqual([]);
  });

  it("gives every live city at least one prefix, all three digits", () => {
    for (const city of liveCities) {
      expect(city.pincodePrefixes.length).toBeGreaterThan(0);
      for (const prefix of city.pincodePrefixes) expect(prefix).toMatch(/^[1-9][0-9]{2}$/);
    }
  });

  it("keeps locality PINs inside their city's declared prefixes", () => {
    const mismatched: string[] = [];
    for (const locality of localities) {
      const city = cities.find((candidate) => candidate.slug === locality.citySlug);
      if (!city) continue;
      for (const pincode of locality.pincodes) {
        if (!city.pincodePrefixes.includes(pincodePrefix(pincode))) {
          mismatched.push(`${locality.slug}:${pincode}`);
        }
      }
    }
    expect(mismatched).toEqual([]);
  });

  it("does not share a prefix between two cities", () => {
    const owners = new Map<string, string>();
    const clashes: string[] = [];
    for (const city of liveCities) {
      for (const prefix of city.pincodePrefixes) {
        const owner = owners.get(prefix);
        if (owner) clashes.push(`${prefix}: ${owner} vs ${city.slug}`);
        else owners.set(prefix, city.slug);
      }
    }
    expect(clashes).toEqual([]);
  });

  it("lists a city's PINs deduplicated and sorted", () => {
    const pune = pincodesForCity("pune");
    expect(pune).toEqual([...new Set(pune)].sort());
    expect(pune).toContain("411057");
    expect(pune.filter((pincode) => pincode === "411057")).toHaveLength(1);
    expect(pincodesForCity("atlantis")).toEqual([]);
  });

  it("exposes every known PIN once, sorted", () => {
    const known = knownPincodes();
    expect(known).toEqual([...new Set(known)].sort());
    expect(known).toContain("380007");
  });
});

describe("listingMatchesPincode", () => {
  it("matches a listing whose locality serves the PIN", () => {
    expect(listingMatchesPincode("vesu", "395007")).toBe(true);
    expect(listingMatchesPincode("piplod", "395007")).toBe(true);
  });

  it("rejects a locality in the same city that does not serve it", () => {
    expect(listingMatchesPincode("adajan", "395007")).toBe(false);
  });

  it("rejects malformed input rather than matching everything", () => {
    expect(listingMatchesPincode("vesu", "not-a-pin")).toBe(false);
  });
});
