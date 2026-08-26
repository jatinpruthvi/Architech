import { describe, expect, it } from "vitest";
import { imageCountLabel, listingSlides, slideLabels } from "./media";
import { getListingById } from "@/lib/repositories";

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
