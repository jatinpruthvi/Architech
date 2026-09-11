/* ARCHITECH — Canonical property fixtures.
   The hand-authored entries below are the Ahmedabad editorial reference; inventory
   for every other city in the registry is derived deterministically by
   `property-generator.ts` so India-wide coverage stays in sync with `cities.ts`. Structured facts are explicit and reusable across cards, quick view, dossiers, compare, and search. */
import type { AvailabilityCode, PropertyTypeCode } from "./listing-vocabulary";
import type { PropertyDetails } from "./listing-details";
import { generatedListings } from "./property-generator";
import { FIXTURE_AS_OF_ISO, FIXTURE_AS_OF_LABEL } from "./fixture-as-of";

/* The single "as of" date for the illustrative fixture set (see
   `fixture-as-of.ts` for why the constant lives in a leaf module). Every
   fixture-derived date on the site (locality price facts, listing freshness,
   sitemap `lastmod`) is expressed relative to this one constant so the whole
   prototype tells a consistent story and, critically, so no date-carrying
   surface ever reads the wall clock: reading `new Date()` at render time would
   make sitemap `lastmod` change on every build without the underlying content
   changing. */
export { FIXTURE_AS_OF_ISO, FIXTURE_AS_OF_LABEL };

export type Property = {
  id: string; title: string; locality: string; localitySlug: string; city: string; citySlug: string; price: string; priceNum: number; pricePerSqft: string;
  meta: string; bhk: number; area: string; areaNum: number; image: string; badge: string; status: string; note: string;
  /** Absolute media URL (e.g. the R2 public URL) when the data source
      carries one. Renderers prefer this over the local `image` asset name
      (resolved through the edge transform — see lib/media/display-url.ts).
      Undefined in fixture mode, where `image` is the local asset key. */
  imageUrl?: string;
  /** Absolute URLs of the additional photographs (parallels `gallery`, the
      local asset names). Undefined in fixture mode. */
  galleryUrls?: string[];
  /** ISO `YYYY-MM-DD` date the listing's *content* last meaningfully changed.

      Mirrors `Listing.meaningfulUpdatedAt` in `prisma/schema.prisma` (as opposed
      to `updatedAt`, which Prisma bumps on every write). Sitemaps and
      `dateModified` structured data must use this: it is the only field that
      answers "did the page's facts change?" Optional so a listing with no
      recorded update simply omits `lastmod` rather than inventing one. */
  meaningfulUpdatedAt?: string;
  /** Additional real photographs of THIS listing (`image` is the primary).
      Optional: a listing with one photo simply omits it, and the UI must then
      never substitute an unrelated image for it. */
  gallery?: string[];
  propertyType: PropertyTypeCode; availability: AvailabilityCode;
  transaction: "buy" | "rent";
  category: "residential" | "commercial" | "pg" | "plot" | "land" | "auction";
  subtype: "Flat/Apartment" | "Villa" | "Office" | "Shop" | "Plot" | "Land" | "PG/Co-living" | "Bank Auction";
  project: string;
  developer: string;
  details: PropertyDetails;
  featured?: boolean;
  lifecycle?: "DRAFT" | "IN_REVIEW" | "ACTIVE" | "SOLD" | "EXPIRED" | "REMOVED" | "DUPLICATE" | "ARCHIVED";
  /** Resolved canonical target (row id/stableId) when this listing is a
      DUPLICATE. Read by the listing route to issue the 301. */
  canonicalToListingId?: string;
  /** Keep an expired page viewable as noindex only when this value is verified. */
  continuingSeoValue?: boolean;
};

const ahmedabadProperties: Property[] = [
  { id: "garden-courtyard", title: "A garden courtyard in Paldi", locality: "Paldi", localitySlug: "paldi", city: "Ahmedabad", citySlug: "ahmedabad", price: "₹1.85 Cr", priceNum: 18_500_000, pricePerSqft: "₹12,480 / sq ft", meta: "3 BHK · Ready to move", bhk: 3, area: "1,482 sq ft", areaNum: 1482, image: "prop-courtyard", badge: "RERA verified", status: "Updated 2 days ago", meaningfulUpdatedAt: "2026-08-24", propertyType: "APARTMENT", availability: "READY_TO_MOVE", note: "Old trees, kota stone floors, and a courtyard that carries the whole house.", transaction: "buy", category: "residential", subtype: "Flat/Apartment", project: "Paldi Courtyard", developer: "Architech Curated Homes", details: { bathrooms: 2, parkingSpaces: 1, furnishing: "SEMI_FURNISHED", floorNumber: 2, totalFloors: 4, facing: "EAST", possessionLabel: "Ready to move", amenities: ["Reserved parking", "Garden or courtyard", "24×7 water", "Security", "Balcony"] }, featured: true },
  { id: "light-filled-home", title: "Light across every room", locality: "Prahlad Nagar", localitySlug: "prahlad-nagar", city: "Ahmedabad", citySlug: "ahmedabad", price: "₹1.24 Cr", priceNum: 12_400_000, pricePerSqft: "₹11,350 / sq ft", meta: "2 BHK · New launch", bhk: 2, area: "1,092 sq ft", areaNum: 1092, image: "prop-light", badge: "Verified partner", status: "Updated today", meaningfulUpdatedAt: "2026-08-26", propertyType: "APARTMENT", availability: "NEW_LAUNCH", note: "Morning sun through sheer curtains; a single brick wall keeps it grounded.", transaction: "buy", category: "residential", subtype: "Flat/Apartment", project: "Prahlad Light House", developer: "Nivasa Partners", details: { bathrooms: 2, parkingSpaces: 1, furnishing: "UNFURNISHED", floorNumber: 8, totalFloors: 14, facing: "NORTH_EAST", possessionLabel: "New launch", amenities: ["Lift", "Power backup", "Security", "Gym", "Balcony"] }, featured: true },
  { id: "thaltej-dusk-house", title: "A quieter edge of Thaltej", locality: "Thaltej", localitySlug: "thaltej", city: "Ahmedabad", citySlug: "ahmedabad", price: "₹2.40 Cr", priceNum: 24_000_000, pricePerSqft: "₹10,860 / sq ft", meta: "4 BHK · Resale", bhk: 4, area: "2,210 sq ft", areaNum: 2210, image: "prop-thaltej", badge: "RERA verified", status: "Updated 4 days ago", meaningfulUpdatedAt: "2026-08-22", propertyType: "VILLA", availability: "RESALE", note: "Brick and white plaster volumes glowing at blue hour, west of the city's rush.", transaction: "buy", category: "residential", subtype: "Villa", project: "Thaltej Dusk House", developer: "Architech Curated Homes", details: { bathrooms: 3, parkingSpaces: 2, furnishing: "UNFURNISHED", floorNumber: 1, totalFloors: 2, facing: "WEST", possessionLabel: "Resale · possession available", amenities: ["Reserved parking", "Garden or courtyard", "24×7 water", "Security", "Balcony"] }, featured: true },
  { id: "neem-lane-rowhouse", title: "Under the neem canopy", locality: "Navrangpura", localitySlug: "navrangpura", city: "Ahmedabad", citySlug: "ahmedabad", price: "₹98 L", priceNum: 9_800_000, pricePerSqft: "₹10,420 / sq ft", meta: "2 BHK · Resale", bhk: 2, area: "940 sq ft", areaNum: 940, image: "locality-street", badge: "Source reviewed", status: "Updated 1 day ago", meaningfulUpdatedAt: "2026-08-25", propertyType: "ROWHOUSE", availability: "RESALE", note: "A tree-lined lane where the street itself is the amenity.", transaction: "buy", category: "residential", subtype: "Flat/Apartment", project: "Neem Lane Rowhouse", developer: "Architech Curated Homes", details: { bathrooms: 2, parkingSpaces: 1, furnishing: "UNFURNISHED", floorNumber: 0, totalFloors: 2, facing: "NORTH", possessionLabel: "Resale · possession available", amenities: ["Reserved parking", "Garden or courtyard", "Security", "Balcony"] }, featured: false },
  { id: "bopal-garden-flat-rent", title: "A bright 2 BHK for rent in Bopal", locality: "Bopal", localitySlug: "bopal", city: "Ahmedabad", citySlug: "ahmedabad", price: "₹22,000 / mo", priceNum: 2_200_000, pricePerSqft: "₹25 / sq ft / mo", meta: "2 BHK · Furnished", bhk: 2, area: "980 sq ft", areaNum: 980, image: "locality-street", badge: "Source reviewed", status: "Updated today", meaningfulUpdatedAt: "2026-08-26", propertyType: "APARTMENT", availability: "READY_TO_MOVE", note: "A furnished flat on a leafy Bopal lane, moments from the metro corridor.", transaction: "rent", category: "residential", subtype: "Flat/Apartment", project: "Bopal Garden Residency", developer: "Nivasa Partners", details: { bathrooms: 2, parkingSpaces: 1, furnishing: "FURNISHED", floorNumber: 5, totalFloors: 12, facing: "EAST", possessionLabel: "Ready to move", amenities: ["Lift", "Power backup", "24×7 water", "Security", "Balcony", "Gym"] }, featured: true },
  { id: "satellite-studio-rent", title: "Compact studio near Satellite crossroads", locality: "Satellite", localitySlug: "satellite", city: "Ahmedabad", citySlug: "ahmedabad", price: "₹14,000 / mo", priceNum: 1_400_000, pricePerSqft: "₹44 / sq ft / mo", meta: "1 BHK · Semi-furnished", bhk: 1, area: "620 sq ft", areaNum: 620, image: "prop-light", badge: "Verified partner", status: "Updated 2 days ago", meaningfulUpdatedAt: "2026-08-24", propertyType: "APARTMENT", availability: "READY_TO_MOVE", note: "Walkable to the crossroads, with a quiet morning light that makes the room feel bigger.", transaction: "rent", category: "residential", subtype: "Flat/Apartment", project: "Satellite Light Studio", developer: "Architech Curated Homes", details: { bathrooms: 1, parkingSpaces: 0, furnishing: "SEMI_FURNISHED", floorNumber: 3, totalFloors: 6, facing: "SOUTH", possessionLabel: "Ready to move", amenities: ["Lift", "Security", "24×7 water"] }, featured: false },
];

/** All demo inventory: the hand-authored Ahmedabad fixtures lead — they are the
    editorial reference and deliberately model edge cases (a rent-only locality,
    a single RERA-verified locality) that behavioural tests depend on — followed
    by generated coverage for every other city in registry order. */
export const properties: Property[] = [...ahmedabadProperties, ...generatedListings("ahmedabad")];
