/* Locality repository facade.
   Today this is backed by fixture modules; the next production slice can swap
   the implementation to Prisma/database calls without rewriting pages.
   Locality reads are city-scoped: pass a city slug wherever route context has
   one, so a slug collision between two cities can never leak across hubs. */
import { findLocality as findFixtureLocality, localities, localitiesForCity, type Locality } from "@/lib/localities";
import { getCities } from "./cities";

export type { Locality };

/** Every locality across India, or just those in one city when scoped. */
export function getLocalities(citySlug?: string): Locality[] {
  return citySlug ? localitiesForCity(citySlug) : localities;
}

export function getLocalityBySlug(slug?: string, citySlug?: string): Locality | undefined {
  return findFixtureLocality(slug, citySlug);
}

/** `{ city, locality }` pairs for `generateStaticParams` on locality routes. */
export function getLocalityStaticParams() {
  return getCities().flatMap((city) =>
    getLocalities(city.slug).map((locality) => ({ city: city.slug, locality: locality.slug })),
  );
}
