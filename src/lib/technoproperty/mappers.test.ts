import { describe, expect, it } from "vitest";
import { parsePrice, parseSqft, parseDate, toLast4, mapSqliteProperty } from "./mappers";

describe("technoproperty/mappers", () => {
  it("parsePrice handles plain numbers, lac and cr", () => {
    expect(parsePrice("25000")).toBe(25000n);
    expect(parsePrice("₹ 25,000 / month")).toBe(25000n);
    expect(parsePrice("1.25 Cr")).toBe(12500000n);
    expect(parsePrice("55 Lac")).toBe(5500000n);
    expect(parsePrice(null)).toBeNull();
  });

  it("parseSqft pulls the first integer", () => {
    expect(parseSqft("1250 sqft")).toBe(1250);
    expect(parseSqft("1,500 Sq.Ft")).toBe(1500);
    expect(parseSqft(null)).toBeNull();
  });

  it("parseDate handles both ISO and DD/MM/YYYY", () => {
    expect(parseDate("2026-09-17T04:11:00.000Z")?.toISOString().slice(0, 10)).toBe("2026-09-17");
    expect(parseDate("17/09/2026")?.toISOString().slice(0, 10)).toBe("2026-09-17");
    expect(parseDate(null)).toBeNull();
  });

  it("toLast4 returns the last four digits", () => {
    expect(toLast4("+91 98250-54306")).toBe("4306");
    expect(toLast4(null)).toBeNull();
    expect(toLast4("123")).toBeNull();
  });

  it("mapSqliteProperty encrypts the phone and picks the right category", () => {
    const row = {
      property_id: "1f1df41b-a8a8-48be-9ed6-2c4a5a7a6b10",
      property_type: "Residential Rent",
      date_posted: "17/09/2026",
      address: "B-302, Shubh Vastu Heights, Near Godrej Garden City",
      premise_name: "Shubh Vastu Heights",
      area: "Jagatpur",
      rent_price_raw: "₹ 25,000",
      availability_raw: "Immediate",
      condition_raw: "Well maintained",
      property_age: "5-10 years",
      description_raw: "3 BHK semi-furnished",
      furniture_raw: "Semi-Furnished",
      sqft_raw: "1550 sqft",
      key_info: "3 BHK",
      brokerage: "1 month",
      status: null,
      is_rented_out: 0,
      has_gallery: 1,
      note_raw: null,
      owner_name: "Nilesh Shah",
      owner_phone: "9825054306",
      contact_btn_id: "getcntinfo_abc",
      image_urls: '["https://example.com/1.jpg"]',
      is_premium: 0,
      is_shortlisted: 0,
      first_seen_at: "2026-09-17T04:11:00.000Z",
      last_seen_at: "2026-09-17T04:11:00.000Z",
      last_modified_at: "2026-09-17T04:11:00.000Z",
      row_hash: "hash1",
      active: 1,
      category_key: "ResidentialRent",
    };
    const mapped = mapSqliteProperty(row, "org_test");
    expect(mapped.orgId).toBe("org_test");
    expect(mapped.category).toBe("RESIDENTIAL_RENT");
    expect(mapped.ownerName).toBe("Nilesh Shah");
    expect(mapped.ownerPhoneLast4).toBe("4306");
    expect(mapped.ownerPhoneCipher).toBeInstanceOf(Buffer);
    expect(mapped.rentPriceValue).toBe(25000n);
    expect(mapped.sqftValue).toBe(1550);
    expect(mapped.imageUrls).toEqual(["https://example.com/1.jpg"]);
    expect(mapped.isPremium).toBe(false);
    expect(mapped.hasGallery).toBe(true);
  });
});
