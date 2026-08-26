/* Canonical demo property fixtures (server-safe: no client directive). */
import type { AvailabilityCode, PropertyTypeCode } from "./listing-vocabulary";

export type Property = {
  id: string; title: string; locality: string; localitySlug: string; city: string; price: string; priceNum: number; pricePerSqft: string;
  meta: string; bhk: number; area: string; areaNum: number; image: string; badge: string; status: string; note: string;
  propertyType: PropertyTypeCode; availability: AvailabilityCode;
  transaction: "buy" | "rent";
  category: "residential" | "commercial" | "pg" | "plot" | "land" | "auction";
  subtype: "Flat/Apartment" | "Villa" | "Office" | "Shop" | "Plot" | "Land" | "PG/Co-living" | "Bank Auction";
  project: string;
  developer: string;
  featured?: boolean;
  /** Lifecycle governs HTTP/indexability behavior; fixtures default to ACTIVE. */
  lifecycle?: "DRAFT" | "IN_REVIEW" | "ACTIVE" | "SOLD" | "EXPIRED" | "REMOVED" | "DUPLICATE" | "ARCHIVED";
};

export const properties: Property[] = [
  { id: "garden-courtyard", title: "A garden courtyard in Paldi", locality: "Paldi", localitySlug: "paldi", city: "Ahmedabad", price: "₹1.85 Cr", priceNum: 18_500_000, pricePerSqft: "₹12,480 / sq ft", meta: "3 BHK · Ready to move", bhk: 3, area: "1,482 sq ft", areaNum: 1482, image: "prop-courtyard", badge: "RERA verified", status: "Updated 2 days ago", propertyType: "APARTMENT", availability: "READY_TO_MOVE", note: "Old trees, kota stone floors, and a courtyard that carries the whole house.", transaction: "buy", category: "residential", subtype: "Flat/Apartment", project: "Paldi Courtyard", developer: "Architech Curated Homes", featured: true },
  { id: "light-filled-home", title: "Light across every room", locality: "Prahlad Nagar", localitySlug: "prahlad-nagar", city: "Ahmedabad", price: "₹1.24 Cr", priceNum: 12_400_000, pricePerSqft: "₹11,350 / sq ft", meta: "2 BHK · New launch", bhk: 2, area: "1,092 sq ft", areaNum: 1092, image: "prop-light", badge: "Verified partner", status: "Updated today", propertyType: "APARTMENT", availability: "NEW_LAUNCH", note: "Morning sun through sheer curtains; a single brick wall keeps it grounded.", transaction: "buy", category: "residential", subtype: "Flat/Apartment", project: "Prahlad Light House", developer: "Nivasa Partners", featured: true },
  { id: "thaltej-dusk-house", title: "A quieter edge of Thaltej", locality: "Thaltej", localitySlug: "thaltej", city: "Ahmedabad", price: "₹2.40 Cr", priceNum: 24_000_000, pricePerSqft: "₹10,860 / sq ft", meta: "4 BHK · Resale", bhk: 4, area: "2,210 sq ft", areaNum: 2210, image: "prop-thaltej", badge: "RERA verified", status: "Updated 4 days ago", propertyType: "VILLA", availability: "RESALE", note: "Brick and white plaster volumes glowing at blue hour, west of the city's rush.", transaction: "buy", category: "residential", subtype: "Villa", project: "Thaltej Dusk House", developer: "Architech Curated Homes", featured: true },
  { id: "neem-lane-rowhouse", title: "Under the neem canopy", locality: "Navrangpura", localitySlug: "navrangpura", city: "Ahmedabad", price: "₹98 L", priceNum: 9_800_000, pricePerSqft: "₹10,420 / sq ft", meta: "2 BHK · Resale", bhk: 2, area: "940 sq ft", areaNum: 940, image: "locality-street", badge: "Source reviewed", status: "Updated 1 day ago", propertyType: "ROWHOUSE", availability: "RESALE", note: "A tree-lined lane where the street itself is the amenity.", transaction: "buy", category: "residential", subtype: "Flat/Apartment", project: "Neem Lane Rowhouse", developer: "Architech Curated Homes", featured: false },
  { id: "bopal-garden-flat-rent", title: "A bright 2 BHK for rent in Bopal", locality: "Bopal", localitySlug: "bopal", city: "Ahmedabad", price: "₹22,000 / mo", priceNum: 2_200_000, pricePerSqft: "₹25 / sq ft / mo", meta: "2 BHK · Furnished", bhk: 2, area: "980 sq ft", areaNum: 980, image: "locality-street", badge: "Source reviewed", status: "Updated today", propertyType: "APARTMENT", availability: "READY_TO_MOVE", note: "A furnished flat on a leafy Bopal lane, moments from the metro corridor.", transaction: "rent", category: "residential", subtype: "Flat/Apartment", project: "Bopal Garden Residency", developer: "Nivasa Partners", featured: true },
  { id: "satellite-studio-rent", title: "Compact studio near Satellite crossroads", locality: "Satellite", localitySlug: "satellite", city: "Ahmedabad", price: "₹14,000 / mo", priceNum: 1_400_000, pricePerSqft: "₹44 / sq ft / mo", meta: "1 BHK · Semi-furnished", bhk: 1, area: "620 sq ft", areaNum: 620, image: "prop-light", badge: "Verified partner", status: "Updated 2 days ago", propertyType: "APARTMENT", availability: "READY_TO_MOVE", note: "Walkable to the crossroads, with a quiet morning light that makes the room feel bigger.", transaction: "rent", category: "residential", subtype: "Flat/Apartment", project: "Satellite Light Studio", developer: "Architech Curated Homes", featured: false },
];
