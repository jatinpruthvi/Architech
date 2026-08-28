import { describe, expect, it } from "vitest";
import { dbListingToProperty, dbLocalityToLocality } from "./mappers";
import { getDataSourceMode } from "./source";

describe("Prisma repository mappers", () => {
  it("maps database locality rows to UI localities", () => {
    const locality = dbLocalityToLocality({ slug: "paldi", name: "Paldi", hindiName: "पालडी", note: "Central", demoHomeCount: 42, latitude: "23.011000", longitude: "72.559000", bbox: "72,23,73,24" });
    expect(locality.marker).toBe("23.011,72.559");
    expect(locality.hindi).toBe("पालडी");
  });

  it("maps database listing rows to existing Property view model", () => {
    const property = dbListingToProperty({
      stableId: "garden-courtyard",
      slug: "garden-courtyard",
      title: "A garden courtyard in Paldi",
      description: "Old trees and kota floors.",
      priceLabel: "₹1.85 Cr",
      priceInr: 18500000,
      pricePerSqft: "₹12,480 / sq ft",
      bhk: 3,
      areaSqft: 1482,
      availability: "Ready to move",
      verification: "RERA_VERIFIED",
      meaningfulUpdatedAt: "2026-08-24T00:00:00.000Z",
      locality: { slug: "paldi", name: "Paldi" },
      city: { name: "Ahmedabad" },
      media: [{ url: "/images/prop-courtyard.jpg" }],
    });
    expect(property.id).toBe("garden-courtyard");
    expect(property.badge).toBe("RERA verified");
    expect(property.image).toBe("prop-courtyard");
    expect(property.propertyType).toBe("APARTMENT");
    expect(property.availability).toBe("READY_TO_MOVE");
  });

  it("keeps every real photograph of a listing, primary first", () => {
    const property = dbListingToProperty({
      stableId: "two-photos",
      slug: "two-photos",
      title: "Two real photos",
      description: "Primary plus one more of the same home.",
      priceLabel: "₹1.00 Cr",
      priceInr: 10000000,
      locality: { slug: "paldi", name: "Paldi" },
      city: { name: "Ahmedabad" },
      media: [{ url: "/images/prop-courtyard.jpg" }, { url: "/images/prop-light.webp" }],
    });
    expect(property.image).toBe("prop-courtyard");
    expect(property.gallery).toEqual(["prop-light"]);
  });

  it("defaults to fixture mode unless explicitly configured", () => {
    expect(getDataSourceMode(undefined)).toBe("fixture");
    expect(getDataSourceMode("prisma")).toBe("prisma");
    expect(getDataSourceMode("unknown")).toBe("fixture");
  });
});
