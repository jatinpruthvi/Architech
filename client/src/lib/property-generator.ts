/* Deterministic demo-inventory generator for India-wide coverage.

   The six hand-written Ahmedabad fixtures in `properties.ts` remain the
   editorial reference. For every other locality in the registry this module
   derives a small, stable set of listings from the city price band and the
   locality price index, so a new city becomes browsable the moment it is added
   to `cities.ts` — no hand-authored inventory required.

   Everything produced here is ILLUSTRATIVE DEMO DATA (see STATUS.md). It is
   deterministic: the same registry always produces the same listings, so
   snapshots, sitemaps, and static params stay stable between builds. */
import { findCity } from "./cities";
import { localities, type Locality } from "./localities";
import { FIXTURE_AS_OF_ISO, type Property } from "./properties";

/** Small deterministic hash so per-listing variation is stable across builds. */
function seedOf(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash);
}

function pick<T>(list: readonly T[], seed: number, offset = 0): T {
  return list[(seed + offset) % list.length];
}

/** ₹ formatting per Indian conventions: Cr above 1,00,00,000, otherwise L. */
export function formatPrice(rupees: number): string {
  if (rupees >= 10_000_000) return `₹${(rupees / 10_000_000).toFixed(2).replace(/\.00$/, "")} Cr`;
  return `₹${Math.round(rupees / 100_000)} L`;
}

export function formatRent(rupees: number): string {
  return `₹${Math.round(rupees / 1000)},000 / mo`;
}

const IMAGES = ["prop-courtyard", "prop-light", "prop-thaltej", "locality-street"] as const;
// Generated fixtures have no state-authority evidence packet. Never award a
// RERA badge merely to add visual variety; verification is jurisdictional.
const BADGES = ["Verified partner", "Source reviewed"] as const;
/** Relative freshness labels and the exact day-offset each one means. Kept as a
    single table so the visible label and the machine-readable
    `meaningfulUpdatedAt` date can never drift apart. */
const STATUSES = [
  { label: "Updated today", daysAgo: 0 },
  { label: "Updated 1 day ago", daysAgo: 1 },
  { label: "Updated 2 days ago", daysAgo: 2 },
  { label: "Updated 4 days ago", daysAgo: 4 },
] as const;

/** ISO `YYYY-MM-DD` `daysAgo` before the fixture as-of date.

    Deterministic by construction — it reads the shared fixture constant rather
    than the wall clock, so a rebuild never changes a listing's freshness or the
    sitemap `lastmod` derived from it. */
function fixtureDateDaysAgo(daysAgo: number): string {
  const date = new Date(`${FIXTURE_AS_OF_ISO}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - daysAgo);
  return date.toISOString().slice(0, 10);
}
const FACINGS = ["EAST", "NORTH_EAST", "NORTH", "WEST", "SOUTH"] as const;
const DEVELOPERS = ["Architech Curated Homes", "Nivasa Partners", "Sthapati Group", "Anant Realty", "Prithvi Habitat"] as const;

type Blueprint = {
  bhk: number;
  areaNum: number;
  propertyType: Property["propertyType"];
  subtype: Property["subtype"];
  availability: Property["availability"];
  transaction: Property["transaction"];
  titleFor: (locality: string) => string;
  noteFor: (locality: string, city: string) => string;
};

const BLUEPRINTS: Blueprint[] = [
  {
    bhk: 3, areaNum: 1450, propertyType: "APARTMENT", subtype: "Flat/Apartment", availability: "READY_TO_MOVE", transaction: "buy",
    titleFor: (locality) => `A ready 3 BHK in ${locality}`,
    noteFor: (locality, city) => `A corner flat in ${locality} with cross ventilation on two sides — the kind of plan ${city} builders stopped drawing.`,
  },
  {
    bhk: 2, areaNum: 1040, propertyType: "APARTMENT", subtype: "Flat/Apartment", availability: "NEW_LAUNCH", transaction: "buy",
    titleFor: (locality) => `New launch 2 BHK near ${locality}`,
    noteFor: (locality) => `An illustrative early-phase tower in ${locality}: allotment-stage pricing and possession claims require project documents and the applicable state/UT RERA record before publication.`,
  },
  {
    bhk: 4, areaNum: 2180, propertyType: "VILLA", subtype: "Villa", availability: "RESALE", transaction: "buy",
    titleFor: (locality) => `A four-bedroom house in ${locality}`,
    noteFor: (locality) => `Independent, set back from the road, with the mature planting that only a resale in ${locality} gives you.`,
  },
  {
    bhk: 2, areaNum: 960, propertyType: "APARTMENT", subtype: "Flat/Apartment", availability: "READY_TO_MOVE", transaction: "rent",
    titleFor: (locality) => `A furnished 2 BHK for rent in ${locality}`,
    noteFor: (locality) => `Furnished, immediately available, and walkable to the everyday things ${locality} is actually used for.`,
  },
  {
    bhk: 1, areaNum: 610, propertyType: "APARTMENT", subtype: "Flat/Apartment", availability: "READY_TO_MOVE", transaction: "rent",
    titleFor: (locality) => `Compact 1 BHK in ${locality}`,
    noteFor: (locality) => `A single-bedroom flat in ${locality} — small, bright, and priced for a first move to the city.`,
  },
];

function amenitiesFor(seed: number, transaction: Property["transaction"]): string[] {
  const base = ["Lift", "Power backup", "24×7 water", "Security", "Balcony"];
  const extra = ["Reserved parking", "Gym", "Clubhouse", "Garden or courtyard", "Children's play area"];
  return [...base.slice(0, 4), pick(extra, seed), ...(transaction === "buy" ? ["Reserved parking"] : [])].filter(
    (value, index, all) => all.indexOf(value) === index,
  );
}

function buildListing(locality: Locality, blueprint: Blueprint, index: number): Property {
  const city = findCity(locality.citySlug);
  const cityName = city?.name ?? locality.cityName;
  const id = `${locality.slug}-${blueprint.transaction}-${blueprint.bhk}bhk-${index}`;
  const seed = seedOf(id);

  const bandPerSqft = (city?.pricePerSqft ?? 7000) * locality.priceIndex;
  // ±6% deterministic spread so a locality does not look algorithmically flat.
  const spread = 0.94 + ((seed % 13) / 100);
  const areaNum = blueprint.areaNum + (seed % 7) * 10;

  const salePerSqft = Math.round((bandPerSqft * spread) / 10) * 10;
  const saleValue = Math.round((salePerSqft * areaNum) / 10_000) * 10_000;
  // Illustrative gross rental yield ≈ 3% a year.
  const monthlyRent = Math.round((saleValue * 0.03) / 12 / 1000) * 1000;
  const isRent = blueprint.transaction === "rent";
  // One pick drives both the visible freshness label and the machine-readable
  // update date, so the two always agree.
  const status = pick(STATUSES, seed, index);

  return {
    id,
    title: blueprint.titleFor(locality.name),
    locality: locality.name,
    localitySlug: locality.slug,
    city: cityName,
    citySlug: locality.citySlug,
    price: isRent ? formatRent(monthlyRent) : formatPrice(saleValue),
    priceNum: isRent ? monthlyRent * 100 : saleValue,
    pricePerSqft: isRent
      ? `₹${Math.max(1, Math.round(monthlyRent / areaNum))} / sq ft / mo`
      : `₹${salePerSqft.toLocaleString("en-IN")} / sq ft`,
    meta: `${blueprint.bhk} BHK · ${blueprint.availability === "READY_TO_MOVE" ? "Ready to move" : blueprint.availability === "NEW_LAUNCH" ? "New launch" : "Resale"}`,
    bhk: blueprint.bhk,
    area: `${areaNum.toLocaleString("en-IN")} sq ft`,
    areaNum,
    image: pick(IMAGES, seed),
    badge: pick(BADGES, seed, index),
    status: status.label,
    meaningfulUpdatedAt: fixtureDateDaysAgo(status.daysAgo),
    note: blueprint.noteFor(locality.name, cityName),
    propertyType: blueprint.propertyType,
    availability: blueprint.availability,
    transaction: blueprint.transaction,
    category: "residential",
    subtype: blueprint.subtype,
    project: `${locality.name} ${pick(["Residency", "Heights", "Courtyard", "Terraces", "Enclave"], seed)}`,
    developer: pick(DEVELOPERS, seed, index),
    details: {
      bathrooms: Math.max(1, blueprint.bhk - (blueprint.bhk >= 3 ? 1 : 0)),
      parkingSpaces: isRent ? seed % 2 : 1 + (seed % 2),
      furnishing: isRent ? (index % 2 === 0 ? "FURNISHED" : "SEMI_FURNISHED") : "UNFURNISHED",
      floorNumber: seed % 12,
      totalFloors: 12 + (seed % 8),
      facing: pick(FACINGS, seed, index),
      possessionLabel:
        blueprint.availability === "NEW_LAUNCH" ? "New launch" : blueprint.availability === "RESALE" ? "Resale · possession available" : "Ready to move",
      amenities: amenitiesFor(seed, blueprint.transaction),
    },
    featured: index === 0 && locality.priceIndex >= 1,
    lifecycle: "ACTIVE",
  };
}

/** Generated inventory for every locality in the registry.
    Pass a city slug to skip a city that is fully hand-authored. */
export function generatedListings(excludeCitySlug?: string): Property[] {
  return localities
    .filter((locality) => locality.citySlug !== excludeCitySlug)
    .flatMap((locality) =>
      BLUEPRINTS.map((blueprint, index) => buildListing(locality, blueprint, index)),
    );
}
