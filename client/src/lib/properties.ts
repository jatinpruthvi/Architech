/* Canonical demo property fixtures (server-safe: no client directive). */
export type Property = {
  id: string; title: string; locality: string; localitySlug: string; city: string; price: string; priceNum: number; pricePerSqft: string;
  meta: string; bhk: number; area: string; areaNum: number; image: string; badge: string; status: string; note: string;
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
  { id: "garden-courtyard", title: "A garden courtyard in Paldi", locality: "Paldi", localitySlug: "paldi", city: "Ahmedabad", price: "₹1.85 Cr", priceNum: 18_500_000, pricePerSqft: "₹12,480 / sq ft", meta: "3 BHK · Ready to move", bhk: 3, area: "1,482 sq ft", areaNum: 1482, image: "prop-courtyard", badge: "RERA verified", status: "Updated 2 days ago", note: "Old trees, kota stone floors, and a courtyard that carries the whole house.", transaction: "buy", category: "residential", subtype: "Flat/Apartment", project: "Paldi Courtyard", developer: "Architech Curated Homes", featured: true },
  { id: "light-filled-home", title: "Light across every room", locality: "Prahlad Nagar", localitySlug: "prahlad-nagar", city: "Ahmedabad", price: "₹1.24 Cr", priceNum: 12_400_000, pricePerSqft: "₹11,350 / sq ft", meta: "2 BHK · New launch", bhk: 2, area: "1,092 sq ft", areaNum: 1092, image: "prop-light", badge: "Verified partner", status: "Updated today", note: "Morning sun through sheer curtains; a single brick wall keeps it grounded.", transaction: "buy", category: "residential", subtype: "Flat/Apartment", project: "Prahlad Light House", developer: "Nivasa Partners", featured: true },
  { id: "thaltej-dusk-house", title: "A quieter edge of Thaltej", locality: "Thaltej", localitySlug: "thaltej", city: "Ahmedabad", price: "₹2.40 Cr", priceNum: 24_000_000, pricePerSqft: "₹10,860 / sq ft", meta: "4 BHK · Resale", bhk: 4, area: "2,210 sq ft", areaNum: 2210, image: "prop-thaltej", badge: "RERA verified", status: "Updated 4 days ago", note: "Brick and white plaster volumes glowing at blue hour, west of the city's rush.", transaction: "buy", category: "residential", subtype: "Villa", project: "Thaltej Dusk House", developer: "Architech Curated Homes", featured: true },
  { id: "neem-lane-rowhouse", title: "Under the neem canopy", locality: "Navrangpura", localitySlug: "navrangpura", city: "Ahmedabad", price: "₹98 L", priceNum: 9_800_000, pricePerSqft: "₹10,420 / sq ft", meta: "2 BHK · Resale", bhk: 2, area: "940 sq ft", areaNum: 940, image: "locality-street", badge: "Source reviewed", status: "Updated 1 day ago", note: "A tree-lined lane where the street itself is the amenity.", transaction: "buy", category: "residential", subtype: "Flat/Apartment", project: "Neem Lane Rowhouse", developer: "Architech Curated Homes", featured: false },
];
