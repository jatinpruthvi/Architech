/* Listing repository facade.
   Fixture-backed for the prototype; shaped so server routes and client views can
   later move to Prisma/database data without importing fixture arrays directly. */
import { properties, type Property } from "@/lib/properties";

export type { Property };

export function getListings(): Property[] {
  return properties;
}

export function getListingById(id?: string): Property | undefined {
  return getListings().find((property) => property.id === id);
}

export function getListingsByLocality(localitySlug: string): Property[] {
  return getListings().filter((property) => property.localitySlug === localitySlug);
}

export function getRelatedListings(currentId: string, limit = 3): Property[] {
  return getListings().filter((property) => property.id !== currentId).slice(0, limit);
}

export function getListingStaticParams() {
  return getListings().map((property) => ({ id: property.id }));
}
