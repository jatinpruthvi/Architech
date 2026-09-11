import { describe, expect, it } from "vitest";
import { dbListingToProperty, dbLocalityToLocality } from "./mappers";
import { getDataSourceMode } from "./source";
import { mediaDisplayUrl } from "@/lib/media/display-url";

describe("Prisma repository mappers", () => {
  it("maps database locality rows to UI localities", () => {
    const locality = dbLocalityToLocality({ slug: "paldi", name: "Paldi", hindiName: "पालडी", note: "Central", demoHomeCount: 42, latitude: "23.011000", longitude: "72.559000", bbox: "72,23,73,24", city: { slug: "ahmedabad", name: "Ahmedabad" } });
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
      city: { slug: "ahmedabad", name: "Ahmedabad" },
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
      city: { slug: "ahmedabad", name: "Ahmedabad" },
      media: [{ url: "/images/prop-courtyard.jpg" }, { url: "/images/prop-light.webp" }],
    });
    expect(property.image).toBe("prop-courtyard");
    expect(property.gallery).toEqual(["prop-light"]);
  });

  it("carries absolute media URLs (R2 public URLs) alongside the local names", () => {
    const property = dbListingToProperty({
      stableId: "r2-photos",
      slug: "r2-photos",
      title: "Two photos stored in R2",
      description: "Uploads live in the bucket, not public/images.",
      priceLabel: "₹1.00 Cr",
      priceInr: 10000000,
      locality: { slug: "paldi", name: "Paldi" },
      city: { slug: "ahmedabad", name: "Ahmedabad" },
      media: [
        { url: "https://cdn.architech.test/originals/listings/r2-photos/primary.jpg" },
        { url: "https://cdn.architech.test/originals/listings/r2-photos/second.jpg" },
      ],
    });
    // Names still exist for fallback + counts…
    expect(property.image).toBe("primary");
    expect(property.gallery).toEqual(["second"]);
    // …and the absolute URLs run in parallel for the renderers.
    expect(property.imageUrl).toBe("https://cdn.architech.test/originals/listings/r2-photos/primary.jpg");
    expect(property.galleryUrls).toEqual(["https://cdn.architech.test/originals/listings/r2-photos/second.jpg"]);
  });

  it("the full R2 chain resolves a stored object to an edge-transform display URL", () => {
    // This is the "once the configuration is set it works" contract, proven at
    // the logic level: an R2 public URL stored on the media row comes out of
    // the mapper, and the display layer rewrites it to the Cloudflare Image
    // Transformations URL the browser fetches. No bytes ever cross Next.js.
    const baseEnv = { NEXT_PUBLIC_R2_PUBLIC_BASE_URL: "https://cdn.architech.test" } as unknown as Record<string, string | undefined>;
    const property = dbListingToProperty({
      stableId: "r2-chain",
      slug: "r2-chain",
      title: "R2 chain",
      description: "Stored in the bucket.",
      priceLabel: "₹1.00 Cr",
      priceInr: 10000000,
      locality: { slug: "paldi", name: "Paldi" },
      city: { slug: "ahmedabad", name: "Ahmedabad" },
      media: [{ url: "https://cdn.architech.test/originals/listings/r2-chain/primary.jpg" }],
    });
    expect(mediaDisplayUrl(property.imageUrl, 640, baseEnv))
      .toBe("https://cdn.architech.test/img/640-auto/originals/listings/r2-chain/primary.jpg");
    // A relative (fixture) row has no URL, so the display layer yields nothing
    // and the renderer keeps the local asset — fixture mode is untouched.
    const fixture = dbListingToProperty({
      stableId: "fixture-chain",
      slug: "fixture-chain",
      title: "Fixture",
      description: "Local asset.",
      priceLabel: "₹1.00 Cr",
      priceInr: 10000000,
      locality: { slug: "paldi", name: "Paldi" },
      city: { slug: "ahmedabad", name: "Ahmedabad" },
      media: [{ url: "/images/prop-courtyard.jpg" }],
    });
    expect(mediaDisplayUrl(fixture.imageUrl, 640, baseEnv)).toBeUndefined();
  });

  it("leaves the URL fields empty when media URLs are relative (no origin to fetch)", () => {
    const property = dbListingToProperty({
      stableId: "relative-media",
      slug: "relative-media",
      title: "Relative media URLs",
      description: "Legacy local paths.",
      priceLabel: "₹1.00 Cr",
      priceInr: 10000000,
      locality: { slug: "paldi", name: "Paldi" },
      city: { slug: "ahmedabad", name: "Ahmedabad" },
      media: [{ url: "/images/prop-courtyard.jpg" }],
    });
    expect(property.image).toBe("prop-courtyard");
    expect(property.imageUrl).toBeUndefined();
    expect(property.galleryUrls).toBeUndefined();
  });

  it("defaults to fixture mode unless explicitly configured", () => {
    expect(getDataSourceMode(undefined)).toBe("fixture");
    expect(getDataSourceMode("prisma")).toBe("prisma");
    expect(getDataSourceMode("unknown")).toBe("fixture");
  });
});
