import { describe, expect, it } from "vitest";
import { properties } from "@/lib/properties";
/* The seed listings mirror is plain ESM; vitest resolves .mjs exactly like node. */
import { SEED_LISTINGS } from "../../../db/seed-listings.mjs";

/* Seed ↔ fixture listing dossier parity (D5-06 follow-up, non-blocking).

   `db/seed.mjs` provisions the Prisma database; `src/lib/properties.ts` is the
   hand-authored editorial reference the fixture (preview/CI) mode renders
   from. The listing page's JSON-LD and the dossier chips read the structured
   `details` block (bathrooms, parking, furnishing, facing, floor, possession,
   amenities). If the seeded rows carry fewer or different fields than the
   fixtures, a prisma-mode page silently ships poorer JSON-LD than the fixture
   preview — exactly the parity gap D5-06 names. Match by stableId and require
   the structured details to agree field-for-field. */

type SeedListing = {
  stableId: string;
  details: {
    bathrooms?: number;
    parkingSpaces?: number;
    furnishing?: string;
    floorNumber?: number;
    totalFloors?: number;
    facing?: string;
    possessionLabel?: string;
    amenities?: string[];
  };
};

const byId = new Map(properties.map((property) => [property.id, property]));

function sortedAmenities(amenities?: string[]): string[] | undefined {
  return amenities ? [...amenities].sort() : undefined;
}

describe("seed listing dossier parity", () => {
  it("every seeded listing corresponds to a fixture property", () => {
    for (const listing of SEED_LISTINGS as SeedListing[]) {
      expect(byId.has(listing.stableId), `${listing.stableId} has no fixture twin`).toBe(true);
    }
  });

  it("seeded details match the fixture details field-for-field", () => {
    for (const listing of SEED_LISTINGS as SeedListing[]) {
      const fixture = byId.get(listing.stableId);
      if (!fixture) continue;
      expect(listing.details.bathrooms, `${listing.stableId}.bathrooms`).toBe(fixture.details.bathrooms);
      expect(listing.details.parkingSpaces, `${listing.stableId}.parkingSpaces`).toBe(fixture.details.parkingSpaces);
      expect(listing.details.furnishing, `${listing.stableId}.furnishing`).toBe(fixture.details.furnishing);
      expect(listing.details.facing, `${listing.stableId}.facing`).toBe(fixture.details.facing);
      expect(listing.details.floorNumber, `${listing.stableId}.floorNumber`).toBe(fixture.details.floorNumber);
      expect(listing.details.totalFloors, `${listing.stableId}.totalFloors`).toBe(fixture.details.totalFloors);
      expect(listing.details.possessionLabel, `${listing.stableId}.possessionLabel`).toBe(fixture.details.possessionLabel);
      expect(sortedAmenities(listing.details.amenities), `${listing.stableId}.amenities`).toEqual(
        sortedAmenities(fixture.details.amenities),
      );
    }
  });

  it("no fixture property's dossier fields are silently dropped from the seed", () => {
    /* Parity in the other direction for the JSON-LD fields: a fixture listing
       that is seeded must not lose its bathroom/furnishing/facing facts. */
    const seeded = new Set((SEED_LISTINGS as SeedListing[]).map((listing) => listing.stableId));
    for (const fixture of properties.filter((property) => seeded.has(property.id))) {
      expect(fixture.details.bathrooms, `${fixture.id}.bathrooms`).toBeDefined();
      expect(fixture.details.furnishing, `${fixture.id}.furnishing`).toBeDefined();
      expect(fixture.details.facing, `${fixture.id}.facing`).toBeDefined();
    }
  });
});
