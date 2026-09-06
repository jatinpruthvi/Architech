import { describe, expect, it } from "vitest";
import { imageCountLabel, listingPhotos, listingSlides, secondaryImage, secondaryImageUrl, slideLabels } from "./media";
import { getFeaturedListings, getListingById } from "@/lib/repositories";

describe("listing gallery media model", () => {
  it("builds a primary-first gallery with labels", () => {
    const property = getListingById("garden-courtyard")!;
    const slides = listingSlides(property);
    expect(slides.length).toBeGreaterThan(1);
    expect(slides[0].name).toBe(property.image);
    expect(slides[0].label).toBe("Primary view");
    expect(slides.some((s) => s.label === "Facade & materiality")).toBe(true);
    expect(slides.some((s) => s.label === "Neighbourhood")).toBe(true);
  });

  it("does not duplicate the primary image among editorial shots", () => {
    const property = getListingById("neem-lane-rowhouse")!; // primary is locality-street
    const names = listingSlides(property).map((s) => s.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("formats the media count label", () => {
    expect(imageCountLabel(1)).toBe("1 photo");
    expect(imageCountLabel(4)).toBe("4 photos");
  });

  it("exposes ordered slide labels", () => {
    const property = getListingById("light-filled-home")!;
    expect(slideLabels(listingSlides(property))[0]).toBe("Primary view");
  });
});

/* Regression: property cards used to cross-fade a shared editorial stock shot
   on hover, so every card in the grid flipped to the same unrelated image
   (`brick-arch`) that was not a photograph of the home being advertised. */
describe("property card hover image", () => {
  it("returns null when a listing has only its primary photograph", () => {
    const property = getListingById("garden-courtyard")!;
    expect(listingPhotos(property)).toEqual([property.image]);
    expect(secondaryImage(property)).toBeNull();
  });

  it("never falls back to an unrelated stock image for any listing", () => {
    const stock = new Set(["brick-arch", "locality-street", "stepwell"]);
    for (const property of getFeaturedListings(50)) {
      const hover = secondaryImage(property);
      // No gallery on the row => no hover photo, so no borrowed stock image.
      if (!property.gallery?.length) expect(hover).toBeNull();
      if (hover !== null) {
        expect([property.image, ...(property.gallery ?? [])]).toContain(hover);
        expect(hover).not.toBe(property.image);
      }
      // The old bug: every card cross-faded the same unrelated stock shot.
      expect(hover === "brick-arch" && stock.has(hover) && !property.gallery?.includes("brick-arch")).toBe(false);
    }
  });

  it("returns the next real photograph when a listing has a gallery", () => {
    const property = { ...getListingById("garden-courtyard")!, gallery: ["prop-light", "stepwell"] };
    expect(listingPhotos(property)).toEqual(["prop-courtyard", "prop-light", "stepwell"]);
    expect(secondaryImage(property)).toBe("prop-light");
  });

  it("ignores a gallery entry that repeats the primary image", () => {
    const property = { image: "prop-courtyard", gallery: ["prop-courtyard"] };
    expect(secondaryImage(property)).toBeNull();
  });

  it("places a listing's own gallery photographs ahead of context shots", () => {
    const property = { ...getListingById("garden-courtyard")!, gallery: ["prop-light"] };
    const slides = listingSlides(property);
    expect(slides.map((s) => s.name).slice(0, 2)).toEqual(["prop-courtyard", "prop-light"]);
    expect(slides[1].label).toBe("View 2");
    expect(new Set(slides.map((s) => s.name)).size).toBe(slides.length);
  });
});

/* R2 mode: the mapper carries absolute media URLs (imageUrl/galleryUrls) in
   parallel with the local names. Slides of the real photographs must expose
   the matching URL; editorial context shots have no bucket URL and must not
   pretend to. */
describe("slide media URLs (R2 mode)", () => {
  const r2 = {
    imageUrl: "https://media.architech.test/originals/listings/h1/primary.jpg",
    galleryUrls: ["https://media.architech.test/originals/listings/h1/second.jpg"],
  };

  it("attaches srcUrl to the listing's own photographs, primary first", () => {
    const property = { ...getListingById("garden-courtyard")!, gallery: ["prop-light"], ...r2 };
    const slides = listingSlides(property);
    expect(slides[0].srcUrl).toBe(r2.imageUrl);
    expect(slides[1].srcUrl).toBe(r2.galleryUrls[0]);
    // Editorial context shots carry local names only.
    for (const slide of slides.slice(2)) expect(slide.srcUrl).toBeUndefined();
  });

  it("leaves srcUrl off entirely in fixture mode", () => {
    const slides = listingSlides(getListingById("garden-courtyard")!);
    expect(slides.every((s) => s.srcUrl === undefined)).toBe(true);
  });

  it("exposes the secondary photo's URL in parallel with its name", () => {
    const base = getListingById("garden-courtyard")!;
    const named = { ...base, gallery: ["prop-light"] };
    const withUrls = { ...named, ...r2 };
    expect(secondaryImageUrl(withUrls)).toBe(r2.galleryUrls[0]);
    expect(secondaryImageUrl(named)).toBeNull();
    // The name path and the URL path point at the same photograph slot.
    expect(secondaryImage(withUrls)).toBe(named.gallery![0]);
  });
});
