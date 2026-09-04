import type { Locality } from "@/lib/localities";
import type { Property } from "@/lib/properties";
import type { PropertyDetails } from "@/lib/listing-details";
import { isPropertyTypeCode, labelForAvailability, normalizeAvailability, type AvailabilityCode, type PropertyTypeCode } from "@/lib/listing-vocabulary";
import { listingDetailsFromSourceSummary, normalizeListingDetails, hasAnyListingDetail } from "@/lib/listing-details-contract";
import { normalizeAmenityRows } from "@/lib/realestate/amenities";
import { inrToNumber } from "@/lib/money";

type DecimalLike = { toString(): string } | string | number | null | undefined;

export type DbLocalityRow = {
  slug: string;
  name: string;
  city: { slug: string; name: string };
  priceIndex?: number | null;
  hindiName?: string | null;
  note: string;
  demoHomeCount?: number | null;
  latitude?: DecimalLike;
  longitude?: DecimalLike;
  bbox?: string | null;
  landmarks?: unknown;
  pincodes?: string[] | null;
  postalCodes?: Array<{ postalCode: string }> | null;
};

export type DbListingRow = {
  stableId: string;
  slug: string;
  title: string;
  description: string;
  priceLabel: string;
  /* bigint from Prisma; number when the row came from a fixture or a raw query
     that already narrowed it. inrToNumber accepts both. */
  priceInr: bigint | number;
  pricePerSqft?: string | null;
  bhk?: number | null;
  areaSqft?: number | null;
  availability?: string | null;
  verification?: string | null;
  meaningfulUpdatedAt?: Date | string | null;
  lifecycle?: string | null;
  canonicalToListingId?: string | null;
  locality: {
    slug: string;
    name: string;
  };
  city: {
    slug: string;
    name: string;
  };
  media?: Array<{ url: string; derivatives?: unknown; alt?: string | null }>;
  transactionType?: string | null;
  category?: string | null;
  propertyType?: string | null;
  projectName?: string | null;
  developerName?: string | null;
  sourceSummary?: string | null;
  details?: PropertyDetails | null;
};

function decimalToNumber(value: DecimalLike): number | undefined {
  if (value === null || value === undefined) return undefined;
  const parsed = Number(typeof value === "object" ? value.toString() : value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function coords(latitude?: DecimalLike, longitude?: DecimalLike) {
  const lat = decimalToNumber(latitude);
  const lon = decimalToNumber(longitude);
  if (lat === undefined || lon === undefined) return { coords: "", marker: "" };
  return {
    coords: `${lat.toFixed(3)}° N · ${lon.toFixed(3)}° E`,
    marker: `${lat.toFixed(3)},${lon.toFixed(3)}`,
  };
}

/** Derive a "west,south,east,north" frame when a row has no stored bbox. */
function frameAround(marker: string, padLon = 0.019, padLat = 0.014): string {
  const [lat, lon] = marker.split(",").map((value) => Number(value));
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return "";
  return [lon - padLon, lat - padLat, lon + padLon, lat + padLat].map((value) => value.toFixed(4)).join(",");
}

function imageNamesFromMedia(media?: DbListingRow["media"]): string[] {
  return (media ?? [])
    .map((item) => item?.url ?? "")
    .map((url) => url.split("/").pop()?.replace(/\.(jpg|jpeg|png|webp)$/i, "") ?? "")
    .filter((name) => name.length > 0);
}

function imageNameFromMedia(media?: DbListingRow["media"]): string {
  return imageNamesFromMedia(media)[0] ?? "locality-street";
}

/** Additional real photographs of the same listing (everything past the
    primary). Empty when a row only carries one photo — callers must not
    substitute an unrelated image in that case. */
function galleryFromMedia(media?: DbListingRow["media"]): string[] {
  return imageNamesFromMedia(media).slice(1);
}

function badgeFromVerification(verification?: string | null): string {
  if (verification === "RERA_VERIFIED") return "RERA verified";
  if (verification === "VERIFIED_PARTNER") return "Verified partner";
  if (verification === "SOURCE_REVIEWED") return "Source reviewed";
  return "Source reviewed";
}

function freshnessLabel(value?: Date | string | null): string {
  if (!value) return "Updated recently";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "Updated recently";
  return `Updated ${date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`;
}

export function dbLocalityToLocality(row: DbLocalityRow): Locality {
  const point = coords(row.latitude, row.longitude);
  return {
    slug: row.slug,
    name: row.name,
    hindi: row.hindiName ?? row.name,
    note: row.note,
    homes: row.demoHomeCount ?? 0,
    coords: point.coords,
    marker: point.marker,
    bbox: row.bbox ?? frameAround(point.marker),
    citySlug: row.city.slug,
    cityName: row.city.name,
    priceIndex: row.priceIndex ?? 1,
    pincodes: row.postalCodes?.map((link) => link.postalCode) ?? row.pincodes ?? [],
    // Amenity rows predate the category field in the database, so they are
    // validated and typed here rather than cast: a row that is not
    // [name, distance, category?] is dropped instead of reaching the page.
    landmarks: normalizeAmenityRows(row.landmarks),
  };
}

export function dbListingToProperty(row: DbListingRow): Property {
  const bhk = row.bhk ?? 0;
  const area = row.areaSqft ?? 0;
  const category = ["residential", "commercial", "pg", "plot", "land", "auction"].includes(row.category ?? "")
    ? row.category as Property["category"]
    : "residential";
  const propertyType: PropertyTypeCode = isPropertyTypeCode(row.propertyType) ? row.propertyType : "APARTMENT";
  const availability: AvailabilityCode = normalizeAvailability(row.availability) ?? "READY_TO_MOVE";
  const subtype: Property["subtype"] = propertyType === "VILLA" ? "Villa" : propertyType === "PLOT" ? "Plot" : "Flat/Apartment";
  return {
    id: row.stableId || row.slug,
    title: row.title,
    locality: row.locality.name,
    localitySlug: row.locality.slug,
    city: row.city.name,
    citySlug: row.city.slug,
    price: row.priceLabel,
    priceNum: inrToNumber(row.priceInr, "Listing.priceInr"),
    pricePerSqft: row.pricePerSqft ?? "Rate on request",
    meta: `${bhk} BHK · ${labelForAvailability(availability)}`,
    bhk,
    area: area ? `${area.toLocaleString("en-IN")} sq ft` : "Area on request",
    areaNum: area,
    image: imageNameFromMedia(row.media),
    gallery: galleryFromMedia(row.media),
    badge: badgeFromVerification(row.verification),
    status: freshnessLabel(row.meaningfulUpdatedAt),
    note: row.description,
    propertyType,
    availability,
    transaction: row.transactionType?.toUpperCase() === "RENT" ? "rent" : "buy",
    category,
    subtype,
    project: row.projectName ?? row.title,
    developer: row.developerName ?? "Verified partner",
    lifecycle: lifecycleFromRow(row.lifecycle),
    canonicalToListingId: row.canonicalToListingId ?? undefined,
    /* Structured first, prose second — and "first" only when it is non-empty,
       otherwise a `{}` on the column would mask the fallback entirely.
       `row.details` does not exist on the `Listing` model yet, so today the
       left side is always undefined and the cast at the call site
       (server/prisma.ts) is what stops the compiler from saying so: see
       listing-details-contract.ts for why that column is the real fix and why
       it is deliberately not in this commit. */
    details: hasAnyListingDetail(row.details) ? normalizeListingDetails(row.details) : listingDetailsFromSourceSummary(row.sourceSummary),
  };
}

const PROPERTY_LIFECYCLES: ReadonlySet<string> = new Set(["DRAFT", "IN_REVIEW", "ACTIVE", "SOLD", "EXPIRED", "REMOVED", "DUPLICATE", "ARCHIVED"]);

/** Robust parse of a stored lifecycle into the fixture `Property` shape; a row
    with none is ACTIVE, the documented default for live inventory. */
function lifecycleFromRow(value?: string | null): NonNullable<Property["lifecycle"]> {
  const normalized = String(value ?? "").trim().toUpperCase();
  return PROPERTY_LIFECYCLES.has(normalized) ? (normalized as NonNullable<Property["lifecycle"]>) : "ACTIVE";
}
