import { describe, expect, it } from "vitest";
import { CITIES, LOCALITIES } from "../../../prisma/seed-registry.mjs";
import { cities } from "./cities";
import { localities } from "./localities";

/* The Prisma seed is plain ESM and cannot import the TypeScript registry, so
   `prisma/seed-registry.mjs` is generated from it. If the two drift, a seeded
   database would serve different cities than the routes and sitemap expect —
   these tests fail first.

   Regenerate with: node scripts/data/generate-seed-registry.mjs */
describe("prisma seed registry stays in sync with the place registry", () => {
  it("seeds exactly the registry's cities", () => {
    expect(CITIES.map((city: { slug: string }) => city.slug)).toEqual(cities.map((city) => city.slug));
    for (const city of cities) {
      const seeded = CITIES.find((entry: { slug: string }) => entry.slug === city.slug);
      expect(seeded).toMatchObject({ name: city.name, hindiName: city.hindi, state: city.state, country: "IN" });
    }
  });

  it("seeds exactly the registry's localities, each under the right city", () => {
    expect(LOCALITIES.map((locality: { slug: string }) => locality.slug)).toEqual(localities.map((locality) => locality.slug));
    for (const locality of localities) {
      const seeded = LOCALITIES.find((entry: { slug: string }) => entry.slug === locality.slug);
      expect(seeded).toMatchObject({
        citySlug: locality.citySlug,
        name: locality.name,
        hindiName: locality.hindi,
        note: locality.note,
        demoHomeCount: locality.homes,
        bbox: locality.bbox,
      });
    }
  });

  it("keeps seeded coordinates aligned with registry markers", () => {
    for (const locality of localities) {
      const seeded = LOCALITIES.find((entry: { slug: string }) => entry.slug === locality.slug) as
        | { latitude: string; longitude: string }
        | undefined;
      const [lat, lon] = locality.marker.split(",").map(Number);
      expect(Number(seeded?.latitude)).toBeCloseTo(lat, 5);
      expect(Number(seeded?.longitude)).toBeCloseTo(lon, 5);
    }
  });
});
