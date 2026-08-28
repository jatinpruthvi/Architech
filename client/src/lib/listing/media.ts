/* Listing media / gallery slide model (P1-MEDIA-002).
   Pure, server-safe helper that composes a curated gallery for a listing from
   its primary image plus intentional editorial shots (facade, neighbourhood,
   architectural detail). Deterministic so the gallery, thumbnail rail, counter,
   and JSON-LD all agree. Never invents media that doesn't exist. */

import type { Property } from "@/lib/repositories";

export type ListingSlide = {
  name: string;      // Pic asset key
  alt: string;
  label: string;
};

const EDITORIAL_SHOTS = [
  { name: "brick-arch", label: "Facade & materiality" },
  { name: "locality-street", label: "Neighbourhood" },
  { name: "stepwell", label: "Architecture in context" },
] as const;

/** Compose the gallery slides for a listing: the primary image first, then
    shared editorial context shots, each with a meaningful label. */
export function listingSlides(property: Property): ListingSlide[] {
  const slides: ListingSlide[] = [
    { name: property.image, alt: `${property.title}, ${property.locality}, ${property.city}`, label: "Primary view" },
  ];
  for (const shot of EDITORIAL_SHOTS) {
    if (shot.name === property.image) continue;
    slides.push({
      name: shot.name,
      alt: `${shot.label} near ${property.locality}, ${property.city}`,
      label: shot.label,
    });
  }
  return slides;
}

/** Human-readable media count label used in the gallery counter. */
export function imageCountLabel(count: number): string {
  return `${count} photo${count === 1 ? "" : "s"}`;
}

/** Compact list of slide labels (for the gallery rail + a11y). */
export function slideLabels(slides: ListingSlide[]): string[] {
  return slides.map((slide) => slide.label);
}

/** A deterministic secondary image for a property card's restrained hover
    cross-fade: always a distinct editorial asset, never the primary image. */
export function secondaryImage(property: Pick<Property, "image">): string {
  const candidates = ["brick-arch", "locality-street", "stepwell"] as const;
  return candidates.find((name) => name !== property.image) ?? "brick-arch";
}
