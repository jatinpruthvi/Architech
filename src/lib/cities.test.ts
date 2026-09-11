import { describe, expect, it } from "vitest";
import { cities, citiesByState, findCity, findLiveCity, liveCities } from "./cities";
import { localities, localitiesForCity, findLocality } from "./localities";
import { properties } from "./properties";

/* India-wide coverage contracts. These guard the invariants that let a single
   registry edit launch a city: unique slugs, a city for every locality, a
   locality for every listing, and no orphaned place references. */
describe("city registry", () => {
  it("keeps city slugs unique, lowercase, and ASCII", () => {
    const slugs = cities.map((city) => city.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const slug of slugs) expect(slug).toMatch(/^[a-z0-9-]+$/);
  });

  it("covers multiple states across India, not a single city", () => {
    expect(liveCities.length).toBeGreaterThanOrEqual(10);
    expect(citiesByState().length).toBeGreaterThanOrEqual(8);
    expect(liveCities.map((city) => city.slug)).toContain("ahmedabad");
    expect(liveCities.map((city) => city.slug)).toContain("mumbai");
  });

  it("gives every city the facts a hub page and JSON-LD need", () => {
    for (const city of cities) {
      expect(city.name.length).toBeGreaterThan(1);
      expect(city.state.length).toBeGreaterThan(1);
      expect(city.reraAuthority.length).toBeGreaterThan(1);
      expect(city.marker).toMatch(/^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/);
      expect(city.bbox.split(",")).toHaveLength(4);
      expect(city.pricePerSqft).toBeGreaterThan(0);
      // Every live city sits inside India's bounding box.
      const [lat, lon] = city.marker.split(",").map(Number);
      expect(lat).toBeGreaterThan(6);
      expect(lat).toBeLessThan(37);
      expect(lon).toBeGreaterThan(68);
      expect(lon).toBeLessThan(98);
    }
  });

  it("resolves cities by slug and hides non-live cities from routing", () => {
    expect(findCity("mumbai")?.name).toBe("Mumbai");
    expect(findCity("MUMBAI")?.name).toBe("Mumbai");
    expect(findCity("atlantis")).toBeUndefined();
    for (const city of cities.filter((entry) => entry.status !== "live")) {
      expect(findLiveCity(city.slug)).toBeUndefined();
    }
  });
});

describe("locality registry", () => {
  it("keeps locality slugs unique across every city", () => {
    const slugs = localities.map((locality) => locality.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("attaches every locality to a known city", () => {
    for (const locality of localities) {
      expect(findCity(locality.citySlug), `${locality.slug} has an unknown city`).toBeDefined();
      expect(locality.cityName).toBe(findCity(locality.citySlug)?.name);
      expect(locality.bbox.split(",")).toHaveLength(4);
      expect(locality.coords).toMatch(/°/);
    }
  });

  it("gives every live city at least one locality to browse", () => {
    for (const city of liveCities) {
      expect(localitiesForCity(city.slug).length, `${city.slug} has no localities`).toBeGreaterThan(0);
    }
  });

  it("scopes lookups so identical slugs cannot leak between cities", () => {
    expect(findLocality("paldi", "ahmedabad")?.name).toBe("Paldi");
    expect(findLocality("paldi", "mumbai")).toBeUndefined();
  });
});

describe("India-wide inventory", () => {
  it("carries a resolvable city and locality on every listing", () => {
    for (const property of properties) {
      expect(findCity(property.citySlug), `${property.id} has an unknown city`).toBeDefined();
      const locality = findLocality(property.localitySlug, property.citySlug);
      expect(locality, `${property.id} has an unknown locality`).toBeDefined();
      expect(property.city).toBe(findCity(property.citySlug)?.name);
    }
  });

  it("publishes inventory in every live city, not only Ahmedabad", () => {
    for (const city of liveCities) {
      const cityListings = properties.filter((property) => property.citySlug === city.slug);
      expect(cityListings.length, `${city.slug} has no listings`).toBeGreaterThan(0);
      expect(cityListings.some((property) => property.transaction === "rent")).toBe(true);
      expect(cityListings.some((property) => property.transaction === "buy")).toBe(true);
    }
  });

  it("keeps listing ids unique and prices positive", () => {
    const ids = properties.map((property) => property.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const property of properties) expect(property.priceNum).toBeGreaterThan(0);
  });

  it("prices Mumbai above Jaipur, reflecting the city price bands", () => {
    const median = (citySlug: string) => {
      const values = properties
        .filter((property) => property.citySlug === citySlug && property.transaction === "buy")
        .map((property) => property.priceNum)
        .sort((a, b) => a - b);
      return values[Math.floor(values.length / 2)];
    };
    expect(median("mumbai")).toBeGreaterThan(median("jaipur"));
  });
});
