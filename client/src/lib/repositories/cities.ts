/* City repository facade.
   Fixture-backed today; shaped so routes and views never import the city
   registry directly and can move to Prisma (`model City`) without rewrites. */
import { cities, citiesByState, DEFAULT_CITY_SLUG, findCity, findLiveCity, liveCities, type City } from "@/lib/cities";

export type { City };
export { DEFAULT_CITY_SLUG };

export function getCities(): City[] {
  return liveCities;
}

export function getAllCities(): City[] {
  return cities;
}

export function getCityBySlug(slug?: string): City | undefined {
  return findCity(slug);
}

/** Only cities approved for public routing — use this in route handlers. */
export function getLiveCityBySlug(slug?: string): City | undefined {
  return findLiveCity(slug);
}

export function getCitiesByState() {
  return citiesByState();
}

export function getCityStaticParams() {
  return getCities().map((city) => ({ city: city.slug }));
}
