import type { Locality } from "@/lib/localities";
import type { Property } from "@/lib/properties";
import { isPropertyTypeCode, labelForAvailability, normalizeAvailability, type AvailabilityCode, type PropertyTypeCode } from "@/lib/listing-vocabulary";

type DecimalLike = { toString(): string } | string | number | null | undefined;

export type DbLocalityRow = {
  slug: string;
  name: string;
  hindiName?: string | null;
  note: string;
  demoHomeCount?: number | null;
  latitude?: DecimalLike;
  longitude?: DecimalLike;
  bbox?: string | null;
  landmarks?: unknown;
};

export type DbListingRow = {
  stableId: string;
  slug: string;
  title: string;
  description: string;
  priceLabel: string;
  priceInr: number;
  pricePerSqft?: string | null;
  bhk?: number | null;
  areaSqft?: number | null;
  availability?: string | null;
  verification?: string | null;
  meaningfulUpdatedAt?: Date | string | null;
  locality: {
    slug: string;
    name: string;
  };
  city: {
    name: string;
  };
  media?: Array<{ url: string; derivatives?: unknown; alt?: string | null }>;
  transactionType?: string | null;
  category?: string | null;
  propertyType?: string | null;
  projectName?: string | null;
  developerName?: string | null;
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

function imageNameFromMedia(media?: DbListingRow["media"]): string {
  const url = media?.[0]?.url;
  if (!url) return "locality-street";
  return url.split("/").pop()?.replace(/\.(jpg|jpeg|png|webp)$/i, "") || "locality-street";
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
    bbox: row.bbox ?? "72.4300,22.9650,72.6350,23.0950",
    landmarks: Array.isArray(row.landmarks) ? row.landmarks as [string, string][] : undefined,
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
    price: row.priceLabel,
    priceNum: row.priceInr,
    pricePerSqft: row.pricePerSqft ?? "Rate on request",
    meta: `${bhk} BHK · ${labelForAvailability(availability)}`,
    bhk,
    area: area ? `${area.toLocaleString("en-IN")} sq ft` : "Area on request",
    areaNum: area,
    image: imageNameFromMedia(row.media),
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
  };
}
