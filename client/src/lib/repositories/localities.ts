/* Locality repository facade.
   Today this is backed by fixture modules; the next production slice can swap
   the implementation to Prisma/database calls without rewriting pages. */
import { findLocality as findFixtureLocality, localities, type Locality } from "@/lib/localities";

export type { Locality };

export function getLocalities(): Locality[] {
  return localities;
}

export function getLocalityBySlug(slug?: string): Locality | undefined {
  return findFixtureLocality(slug);
}

export function getLocalityStaticParams() {
  return getLocalities().map((locality) => ({ locality: locality.slug }));
}
