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

export function getListingsByLocality(localitySlug: string, citySlug?: string): Property[] {
  return getListings().filter(
    (property) => property.localitySlug === localitySlug && (!citySlug || property.citySlug === citySlug),
  );
}

/** Every listing in a city, across its localities. */
export function getListingsByCity(citySlug: string): Property[] {
  return getListings().filter((property) => property.citySlug === citySlug);
}

/** A small, stable showcase set for the home page.
    Featured listings first, then registry order — never the whole national
    inventory, which would bloat the document and the client payload. */
export function getFeaturedListings(limit = 8, citySlug?: string): Property[] {
  const pool = citySlug ? getListingsByCity(citySlug) : getListings();
  const featured = pool.filter((property) => property.featured);
  return [...featured, ...pool.filter((property) => !property.featured)].slice(0, limit);
}

/** Related homes prefer the same city so a Mumbai dossier never suggests Jaipur. */
export function getRelatedListings(currentId: string, limit = 3): Property[] {
  const current = getListingById(currentId);
  const pool = getListings().filter((property) => property.id !== currentId);
  const sameCity = current ? pool.filter((property) => property.citySlug === current.citySlug) : [];
  return [...sameCity, ...pool.filter((property) => !sameCity.includes(property))].slice(0, limit);
}

export function getListingStaticParams() {
  return getListings().map((property) => ({ id: property.id }));
}
