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
/* Siblings, nearest first.

   The ordering is the point of authority routing: a listing's strongest
   internal links are the ones sharing its query, and query is dominated by
   locality. Ranking a Bandra listing next to a Thane one because both are in
   the same city spends a link on a page that answers a different question.

   Deliberately still capped at three. The grid that renders these is three
   columns, so three fills exactly one row; five would leave a ragged second
   row and six would double the scroll for marginal link equity. Raising the
   number is a layout decision, not an SEO one. */
export function getRelatedListings(currentId: string, limit = 3): Property[] {
  const current = getListingById(currentId);
  const pool = getListings().filter((property) => property.id !== currentId);
  if (!current) return pool.slice(0, limit);

  const sameLocality = pool.filter(
    (property) => property.localitySlug === current.localitySlug && property.citySlug === current.citySlug,
  );
  const sameCity = pool.filter(
    (property) => property.citySlug === current.citySlug && !sameLocality.includes(property),
  );
  const rest = pool.filter((property) => !sameLocality.includes(property) && !sameCity.includes(property));

  return [...sameLocality, ...sameCity, ...rest].slice(0, limit);
}

export function getListingStaticParams() {
  return getListings().map((property) => ({ id: property.id }));
}
