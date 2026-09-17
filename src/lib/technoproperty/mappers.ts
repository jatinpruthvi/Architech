/**
 * Normalise rows from the crawler's SQLite (ops/crawlAutomation) into Prisma-shaped
 * objects ready to upsert into Postgres via `TechnoProperty`.
 *
 * Field names match the crawler's SQLite schema (see ops/crawlAutomation/lib/db.mjs).
 */
import "server-only";
import { TechnoCategory, TechnoSourceStatus } from "@prisma/client";
import { encryptContact } from "@/lib/interop/contact-crypto";
import { categoryKeyToEnum } from "./categories";

export interface CrawlPropertyRow {
  property_id: string;
  property_type?: string | null;
  date_posted?: string | null;
  address?: string | null;
  premise_name?: string | null;
  area?: string | null;
  rent_price_raw?: string | null;
  availability_raw?: string | null;
  condition_raw?: string | null;
  property_age?: string | null;
  description_raw?: string | null;
  furniture_raw?: string | null;
  sqft_raw?: string | null;
  key_info?: string | null;
  brokerage?: string | null;
  status?: string | null;
  is_rented_out?: number | boolean | null;
  has_gallery?: number | boolean | null;
  note_raw?: string | null;
  owner_name?: string | null;
  owner_phone?: string | null;
  contact_btn_id?: string | null;
  image_urls?: string | null; // JSON string in SQLite
  is_premium?: number | boolean | null;
  is_shortlisted?: number | boolean | null;
  first_seen_at: string;
  last_seen_at: string;
  last_modified_at?: string | null;
  row_hash: string;
  active?: number | boolean | null;
  category_key: string; // e.g. "ResidentialRent"
}

function toBool(v: number | boolean | null | undefined): boolean {
  if (v === null || v === undefined) return false;
  if (typeof v === "boolean") return v;
  return v === 1;
}

export function parsePrice(raw: string | null | undefined): bigint | null {
  if (!raw) return null;
  // Pull digits out of messy strings like "₹ 25,000 / month" or "1.25 Cr" or "55 Lac"
  const clean = raw.replace(/[₹,\s]/g, "");
  const cr = clean.match(/([\d.]+)\s*cr/i);
  if (cr) return BigInt(Math.round(parseFloat(cr[1]) * 1_00_00_000));
  const lac = clean.match(/([\d.]+)\s*lac?/i);
  if (lac) return BigInt(Math.round(parseFloat(lac[1]) * 1_00_000));
  const num = clean.match(/\d+/);
  if (!num) return null;
  try {
    return BigInt(num[0]);
  } catch {
    return null;
  }
}

export function parseSqft(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const m = raw.replace(/[,\s]/g, "").match(/\d+/);
  if (!m) return null;
  const n = parseInt(m[0], 10);
  return Number.isFinite(n) ? n : null;
}

export function parseDate(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  // Crawler stores as ISO; rows from DataTable come as DD/MM/YYYY.
  const iso = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  if (iso) return new Date(iso[1] + "T00:00:00Z");
  const dm = raw.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (dm) {
    const [, d, m, y] = dm;
    return new Date(`${y}-${m}-${d}T00:00:00Z`);
  }
  const t = Date.parse(raw);
  return Number.isFinite(t) ? new Date(t) : null;
}

export function toLast4(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 4 ? digits.slice(-4) : null;
}

export function parseImageUrls(raw: string | null | undefined): string[] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.filter((x) => typeof x === "string");
  } catch {
    /* ignore */
  }
  return null;
}

export interface MappedPropertyInput {
  externalId: string;
  category: TechnoCategory;
  propertyType: string | null;
  datePosted: Date | null;
  address: string | null;
  premiseName: string | null;
  area: string | null;
  rentPriceRaw: string | null;
  rentPriceValue: bigint | null;
  availabilityRaw: string | null;
  conditionRaw: string | null;
  propertyAge: string | null;
  descriptionRaw: string | null;
  furnitureRaw: string | null;
  sqftRaw: string | null;
  sqftValue: number | null;
  keyInfo: string | null;
  brokerage: string | null;
  isRentedOut: boolean;
  soldOut: boolean;
  hasGallery: boolean;
  isPremium: boolean;
  sourceShortlisted: boolean;
  ownerName: string | null;
  ownerPhoneCipher: Buffer | null;
  ownerPhoneLast4: string | null;
  contactBtnId: string | null;
  imageUrls: string[] | null;
  sourceStatus: TechnoSourceStatus;
  firstSeenAt: Date;
  lastSeenAt: Date;
  lastModifiedAt: Date;
  rowHash: string;
  active: boolean;
}

export function mapSqliteProperty(
  row: CrawlPropertyRow,
  orgId: string,
): { orgId: string } & MappedPropertyInput {
  const rented = toBool(row.is_rented_out);
  const category = categoryKeyToEnum(row.category_key);
  // "sold" isn't explicit in the crawler schema today — mark via status/key_info.
  const sold =
    !!row.status && /sold/i.test(row.status) && !/rent/i.test(row.category_key);
  const datePosted = parseDate(row.date_posted);
  const phone = row.owner_phone?.replace(/\D/g, "") || null;
  const cipher = phone && phone.length >= 10 ? encryptContact(phone) : null;
  return {
    orgId,
    externalId: row.property_id,
    category,
    propertyType: row.property_type?.toString()?.trim() || null,
    datePosted,
    address: row.address?.toString()?.trim() || null,
    premiseName: row.premise_name?.toString()?.trim() || null,
    area: row.area?.toString()?.trim() || null,
    rentPriceRaw: row.rent_price_raw?.toString()?.trim() || null,
    rentPriceValue: parsePrice(row.rent_price_raw),
    availabilityRaw: row.availability_raw?.toString()?.trim() || null,
    conditionRaw: row.condition_raw?.toString()?.trim() || null,
    propertyAge: row.property_age?.toString()?.trim() || null,
    descriptionRaw: row.description_raw?.toString()?.trim() || null,
    furnitureRaw: row.furniture_raw?.toString()?.trim() || null,
    sqftRaw: row.sqft_raw?.toString()?.trim() || null,
    sqftValue: parseSqft(row.sqft_raw),
    keyInfo: row.key_info?.toString()?.trim() || null,
    brokerage: row.brokerage?.toString()?.trim() || null,
    isRentedOut: rented,
    soldOut: sold,
    hasGallery: toBool(row.has_gallery),
    isPremium: toBool(row.is_premium) || category === TechnoCategory.PREMIUM,
    sourceShortlisted: toBool(row.is_shortlisted) || category === TechnoCategory.IMPORTANT,
    ownerName: row.owner_name?.toString()?.trim() || null,
    ownerPhoneCipher: cipher,
    ownerPhoneLast4: toLast4(phone),
    contactBtnId: row.contact_btn_id?.toString()?.trim() || null,
    imageUrls: parseImageUrls(row.image_urls),
    sourceStatus: rented
      ? TechnoSourceStatus.RENTED_OUT
      : sold
        ? TechnoSourceStatus.SOLD
        : toBool(row.active)
          ? TechnoSourceStatus.ACTIVE
          : TechnoSourceStatus.REMOVED,
    firstSeenAt: new Date(row.first_seen_at),
    lastSeenAt: new Date(row.last_seen_at),
    lastModifiedAt: new Date(row.last_modified_at ?? row.last_seen_at),
    rowHash: row.row_hash,
    active: toBool(row.active ?? true),
  };
}
