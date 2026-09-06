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
  /* The real `Listing.detailsJson` column (added by migration
     `202609050001_listing_details_json`). Prisma types it `JsonValue`, so it
     lands here as `unknown` and is validated field-by-field before the UI
     ever sees it — never trust raw JSONB. */
  detailsJson?: unknown;
  /** Accept legacy callers that passed the pre-column stand-in name; both are
      validated identically, so aliasing costs nothing. */
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

/** Absolute media URLs (R2 public URLs in r2 mode), in source order. Relative
    or scheme-less URLs are dropped: they have no origin the browser can
    fetch, so the local-asset-name path (imageNamesFromMedia) stands in. */
function mediaAbsoluteUrls(media?: DbListingRow["media"]): string[] {
  return (media ?? [])
    .map((item) => item?.url ?? "")
    .filter((url) => /^https?:\/\//.test(url));
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

/* The two freshness renderings below are ICU calls (toLocaleDateString /
   toISOString) — the most expensive pure work the mapper does per row, and a
   5,000-row read would otherwise pay them 5,000× per request. The key to
   memoising them cheaply: the label is `Updated <d MMM yyyy>` — a pure
   function of the LOCAL calendar day — and the isoDay (`toISOString().slice(0,10)`)
   is a pure function of the UTC day. NEITHER uses the time of day. Inventory
   timestamps are effectively unique per row (feed imports, per-listing
   updates), so a per-millisecond key misses on almost every row and buys
   nothing. Key by the pair of calendar days instead — computed with plain
   Date getters (no ICU, no toISOString) — so a read spanning N days pays N
   formatting costs total instead of one per row. A cache miss computes the
   value exactly the way the original code did, so output is unchanged;
   clearing the bound can only change speed, never output. */
const freshnessByDay = new Map<string, { label: string; isoDay: string }>();

function freshnessParts(value?: Date | string | null): { label: string; isoDay?: string } {
  if (!value) return { label: "Updated recently" };
  const date = typeof value === "string" ? new Date(value) : value;
  const time = date.getTime();
  if (Number.isNaN(time)) return { label: "Updated recently" };
  const key = `${date.getFullYear()}:${date.getMonth() + 1}:${date.getDate()}:${date.getUTCFullYear()}:${date.getUTCMonth()}:${date.getUTCDate()}`;
  const cached = freshnessByDay.get(key);
  if (cached) return cached;
  const parts = {
    label: `Updated ${date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`,
    isoDay: date.toISOString().slice(0, 10),
  };
  if (freshnessByDay.size > 4096) freshnessByDay.clear();
  freshnessByDay.set(key, parts);
  return parts;
}

/** Memoized en-IN grouping for the area label (area values are
    low-cardinality integers; same bound-and-clear contract as the freshness
    cache above). */
const areaByValue = new Map<number, string>();
function formatArea(area: number): string {
  const cached = areaByValue.get(area);
  if (cached !== undefined) return cached;
  const formatted = area.toLocaleString("en-IN");
  if (areaByValue.size > 2048) areaByValue.clear();
  areaByValue.set(area, formatted);
  return formatted;
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
  /* ONE parse + at most ONE ICU formatting per row: `status` and the dossier
     stamp derive from the same cached pair (previously two `new Date` parses
     and two ICU calls each). */
  const freshness = freshnessParts(row.meaningfulUpdatedAt);
  // Absolute media URLs (R2 public URLs) when the source stores them —
  // renderers prefer these over the local asset names. Absent when the source
  // stores none, so fixture-style rows keep a single shape.
  const mediaUrls = mediaAbsoluteUrls(row.media);
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
    area: area ? `${formatArea(area)} sq ft` : "Area on request",
    areaNum: area,
    image: imageNameFromMedia(row.media),
    gallery: galleryFromMedia(row.media),
    ...mediaUrls.length
      ? { imageUrl: mediaUrls[0], galleryUrls: mediaUrls.length > 1 ? mediaUrls.slice(1) : undefined }
      : {},
    badge: badgeFromVerification(row.verification),
    status: freshness.label,
    /* The absolute freshness stamp the dossier renders. Prisma hands us a
       Date (or a driver string); the fixture shape is an ISO date — normalize
       here so "Updated on <date>" renders identically in both data modes.
       (A corrupt/NaN timestamp now degrades to `undefined` instead of
       throwing in `toISOString()` — the old path 500'd on such a row.) */
    meaningfulUpdatedAt: freshness.isoDay,
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
       `detailsJson` is the real column (migration
       `202609050001_listing_details_json`); the legacy `details` alias covers
       any caller still holding a pre-column row shape. Rows stored before the
       column existed have neither, and fall through to the validated prose
       scrape of `sourceSummary` exactly as before. */
    details: (() => {
      const stored = row.detailsJson ?? row.details;
      return hasAnyListingDetail(stored) ? normalizeListingDetails(stored) : listingDetailsFromSourceSummary(row.sourceSummary);
    })(),
  };
}

const PROPERTY_LIFECYCLES: ReadonlySet<string> = new Set(["DRAFT", "IN_REVIEW", "ACTIVE", "SOLD", "EXPIRED", "REMOVED", "DUPLICATE", "ARCHIVED"]);

/** Robust parse of a stored lifecycle into the fixture `Property` shape; a row
    with none is ACTIVE, the documented default for live inventory. */
function lifecycleFromRow(value?: string | null): NonNullable<Property["lifecycle"]> {
  const normalized = String(value ?? "").trim().toUpperCase();
  return PROPERTY_LIFECYCLES.has(normalized) ? (normalized as NonNullable<Property["lifecycle"]>) : "ACTIVE";
}
