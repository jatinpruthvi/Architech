import type { Property } from "@/lib/repositories";

export const MAX_COMPARE_HOMES = 4;

export const COMPARE_ROWS: { label: string; get: (property: Property) => string }[] = [
  { label: "Price", get: (property) => property.price },
  { label: "Rate", get: (property) => property.pricePerSqft },
  { label: "Layout", get: (property) => property.meta },
  { label: "Carpet area", get: (property) => property.area },
  { label: "Locality", get: (property) => property.locality },
  { label: "Verification", get: (property) => property.badge },
  { label: "Availability", get: (property) => property.status },
  { label: "Evidence", get: (property) => property.note },
];

export function normalizeCompareIds(value: string | string[] | undefined): string[] {
  const values = Array.isArray(value) ? value : [value ?? ""];
  return values.flatMap((item) => item.split(",")).map((item) => item.trim()).filter(Boolean).slice(0, MAX_COMPARE_HOMES);
}

export function selectComparableListings(listings: Property[], value: string | string[] | undefined): Property[] {
  const ids = new Set(normalizeCompareIds(value));
  return listings.filter((listing) => ids.has(listing.id)).slice(0, MAX_COMPARE_HOMES);
}
