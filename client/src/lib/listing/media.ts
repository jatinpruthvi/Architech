/* Listing media / gallery slide model (P1-MEDIA-002).
   Pure, server-safe helper that composes a curated gallery for a listing from
   its own photographs, plus intentional editorial context shots (facade,
   neighbourhood, architectural detail). Deterministic so the gallery, thumbnail
   rail, counter, and JSON-LD all agree. Never invents media that doesn't exist. */

import type { Property } from "@/lib/repositories";

export type ListingSlide = {
  name: string;      // Pic asset key
  alt: string;
  label: string;
};

/* Shared context photography. These are NOT photographs of the listed home —
   they are city/context shots, so they are always surfaced with an explicit
   label and never used as a stand-in for a photo of the property itself. */
const EDITORIAL_SHOTS = [
  { name: "brick-arch", label: "Facade & materiality" },
  { name: "locality-street", label: "Neighbourhood" },
  { name: "stepwell", label: "Architecture in context" },
] as const;

/** The listing's own photographs, primary first, de-duplicated and in source
    order. A listing with a single photograph yields exactly one entry. */
export function listingPhotos(property: Pick<Property, "image" | "gallery">): string[] {
  const photos: string[] = [];
  for (const name of [property.image, ...(property.gallery ?? [])]) {
    if (!name || photos.includes(name)) continue;
    photos.push(name);
  }
  return photos;
}

/** Compose the gallery slides for a listing: every real photograph of that
    listing first (primary at the head), then shared editorial context shots,
    each with a meaningful label. */
export function listingSlides(property: Property): ListingSlide[] {
  const photos = listingPhotos(property);
  const place = `${property.locality}, ${property.city}`;
  const slides: ListingSlide[] = photos.map((name, index) => ({
    name,
    alt: index === 0 ? `${property.title}, ${place}` : `${property.title}, ${place} — view ${index + 1}`,
    label: index === 0 ? "Primary view" : `View ${index + 1}`,
  }));
  for (const shot of EDITORIAL_SHOTS) {
    if (slides.some((slide) => slide.name === shot.name)) continue;
    slides.push({
      name: shot.name,
      alt: `${shot.label} near ${place}`,
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

/** The one image a property card may cross-fade to on hover: a second real
    photograph OF THAT LISTING. Returns null when the listing only has one
    photo — a card must never swap in an unrelated stock image and pass it off
    as the home being advertised. */
export function secondaryImage(property: Pick<Property, "image" | "gallery">): string | null {
  return listingPhotos(property)[1] ?? null;
}
