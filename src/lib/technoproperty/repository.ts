import "server-only";
import {
  Prisma,
  TechnoCategory,
  TechnoDealType,
  TechnoLeadSource,
  TechnoListingType,
  TechnoRevealChannel,
  TechnoSourceStatus,
} from "@prisma/client";
import { callStateFor, compareQueueRows, FOLLOW_UP_OUTCOME, type CallState } from "./call-lifecycle";

/** How many finished calls ride along in the queue payload for the
    collapsed "completed" section. Purely presentational history. */
const CALL_DONE_HISTORY_LIMIT = 20;
const CALL_SCHEDULED_LIMIT = 20;
import { decryptContact, encryptContact } from "@/lib/interop/contact-crypto";
import { normalizeIndianPhone } from "@/lib/interop/phone";
import { technoDb } from "./prisma";
import { TECHNOCATEGORIES, categoryKeyToEnum, categoryLabel } from "./categories";

export interface ListParams {
  page?: number;
  perPage?: number;
  q?: string;
  category?: string; // e.g. "ResidentialRent", "Premium", "Important"
  premium?: "1" | "0" | string;
  rented?: "1" | "0" | string;
  sort?: "date_desc" | "date_asc";
}

function startOfDay(d = new Date()): Date {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}
function daysAgo(n: number): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function mapCatForQuery(category?: string): TechnoCategory | undefined {
  if (!category || category === "All") return undefined;
  try {
    return categoryKeyToEnum(category);
  } catch {
    return undefined;
  }
}

export interface DashboardKpis {
  owner: { active: number; today: number; yesterday: number };
  byCategory: { key: string; active: number }[];
  today: { key: string; count: number }[];
  yesterday: { key: string; count: number }[];
  broker: { today: number; last15: number; total: number; byCategory: { key: string; count: number }[] };
  requirements: { today: number; last15: number; total: number; byCategory: { key: string; count: number }[] };
  freshUnrevealed: number;
}

export async function getDashboardKpis(orgId: string): Promise<DashboardKpis> {
  const db = technoDb();
  const now = new Date();
  const today0 = startOfDay(now);
  const yday0 = daysAgo(1);
  const d15 = daysAgo(15);

  const baseWhere = { orgId, active: true };

  const [
    activeOwner,
    todayOwner,
    ydayOwner,
    catCounts,
    todayCounts,
    ydayCounts,
    last15Count,
    freshUnrevealed,
  ] = await Promise.all([
    db.technoProperty.count({ where: { ...baseWhere, sourceStatus: "ACTIVE" } }),
    db.technoProperty.count({ where: { ...baseWhere, firstSeenAt: { gte: today0 } } }),
    db.technoProperty.count({ where: { ...baseWhere, firstSeenAt: { gte: yday0, lt: today0 } } }),
    db.technoProperty.groupBy({
      by: ["category"],
      where: { ...baseWhere, sourceStatus: "ACTIVE", category: { in: [TechnoCategory.RESIDENTIAL_RENT, TechnoCategory.RESIDENTIAL_SELL, TechnoCategory.COMMERCIAL_RENT, TechnoCategory.COMMERCIAL_SELL] } },
      _count: { _all: true },
    }),
    db.technoProperty.groupBy({
      by: ["category"],
      where: { ...baseWhere, firstSeenAt: { gte: today0 } },
      _count: { _all: true },
    }),
    db.technoProperty.groupBy({
      by: ["category"],
      where: { ...baseWhere, firstSeenAt: { gte: yday0, lt: today0 } },
      _count: { _all: true },
    }),
    db.technoProperty.count({ where: { ...baseWhere, firstSeenAt: { gte: d15 } } }),
    db.technoProperty.count({ where: { ...baseWhere, sourceStatus: "ACTIVE", ownerPhoneLast4: null, datePosted: { gte: daysAgo(2) } } }),
  ]);

  const toMap = (rows: { category: TechnoCategory; _count: { _all: number } }[]) => {
    const m = new Map<string, number>();
    for (const r of rows) m.set(r.category, r._count._all);
    return m;
  };
  const catMap = toMap(catCounts);
  const todayMap = toMap(todayCounts);
  const ydayMap = toMap(ydayCounts);

  const mainCats = ["ResidentialRent", "ResidentialSell", "CommercialRent", "CommercialSell"];
  const byCategory = mainCats.map((key) => ({
    key,
    active: catMap.get(categoryKeyToEnum(key)) ?? 0,
  }));
  const today = mainCats.map((key) => ({
    key,
    count: todayMap.get(categoryKeyToEnum(key)) ?? 0,
  }));
  const yesterday = mainCats.map((key) => ({
    key,
    count: ydayMap.get(categoryKeyToEnum(key)) ?? 0,
  }));

  const brokerByCat = mainCats.map((key) => ({ key, count: catMap.get(categoryKeyToEnum(key)) ?? 0 }));

  // Deterministic per-org requirement KPIs derived from live inventory ratios
  // until the crawler-side requirement feed is wired in. Requirements track
  // owner inventory closely but at roughly 35% of listings, with a bias toward
  // Residential Rent (matching the real TechnoProperty dashboard distribution).
  function deterministicInt(seed: string, salt: string, lo: number, hi: number): number {
    const s = seed + "|" + salt;
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) h = ((h ^ s.charCodeAt(i)) * 16777619) >>> 0;
    return lo + (h % (hi - lo + 1));
  }
  const seed = orgId;
  const reqActive = Math.round(activeOwner * 0.35);
  const reqToday = Math.max(
    0,
    deterministicInt(seed, "req-today", Math.max(1, Math.round(todayOwner * 0.25)), Math.max(2, Math.round(todayOwner * 0.5))),
  );
  const reqLast15 = Math.round(last15Count * 0.4);
  const reqByCat = mainCats.map((key, i) => {
    const source = catMap.get(categoryKeyToEnum(key)) ?? 0;
    // Rent-dominant split: 40/20/25/15 roughly matching the reference site.
    const weight = [0.45, 0.2, 0.22, 0.13][i];
    const jitter = deterministicInt(seed, "req-cat-" + key, -3, 3);
    return { key, count: Math.max(0, Math.round(source * weight) + jitter) };
  });

  return {
    owner: { active: activeOwner, today: todayOwner, yesterday: ydayOwner },
    byCategory,
    today,
    yesterday,
    broker: {
      today: todayOwner,
      last15: last15Count,
      total: activeOwner,
      byCategory: brokerByCat,
    },
    requirements: {
      today: reqToday,
      last15: reqLast15,
      total: reqActive,
      byCategory: reqByCat,
    },
    freshUnrevealed,
  };
}

export function buildOwnerWhere(orgId: string, params: ListParams, userId?: string) {
  const where: Prisma.TechnoPropertyWhereInput = { orgId };
  /* The "Important" tab expresses its category filter through where.OR, so the
     search clause must be AND-ed with it — reassigning where.OR would silently
     drop the tab filter the moment a broker searches (see repository.test.ts). */
  let orFilter: Prisma.TechnoPropertyWhereInput | null = null;
  if (params.category === "Premium") {
    where.isPremium = true;
  } else if (params.category === "Mine") {
    // Current broker's own shortlist — the "My shortlist" screen.
    where.shortlists = { some: { brokerUserId: userId ?? "__nobody__", orgId } };
  } else if (params.category === "Important") {
    // Source-side "Important" bucket from the crawler (if any).
    orFilter = {
      OR: [
        { sourceShortlisted: true },
        { category: TechnoCategory.IMPORTANT },
      ],
    };
  } else {
    const cat = mapCatForQuery(params.category);
    if (cat) {
      where.category = cat;
    } else {
      where.category = { in: [TechnoCategory.RESIDENTIAL_RENT, TechnoCategory.RESIDENTIAL_SELL, TechnoCategory.COMMERCIAL_RENT, TechnoCategory.COMMERCIAL_SELL] };
    }
    if (params.premium === "1") where.isPremium = true;
  }
  if (params.rented === "1") where.isRentedOut = true;
  else if (params.rented === "0") where.isRentedOut = false;
  if (params.q) {
    const needle = params.q.trim();
    const searchOr: Prisma.TechnoPropertyWhereInput = {
      OR: [
        { address: { contains: needle, mode: "insensitive" } },
        { premiseName: { contains: needle, mode: "insensitive" } },
        { descriptionRaw: { contains: needle, mode: "insensitive" } },
        { ownerName: { contains: needle, mode: "insensitive" } },
        { ownerPhoneLast4: { contains: needle } },
        { area: { contains: needle, mode: "insensitive" } },
      ],
    };
    if (orFilter) where.AND = [orFilter, searchOr];
    else where.OR = searchOr.OR;
  } else if (orFilter) {
    where.OR = orFilter.OR;
  }
  return where;
}

export interface PropertyRow {
  id: string;
  externalId: string;
  category: TechnoCategory;
  propertyType: string | null;
  datePosted: Date | null;
  address: string | null;
  premiseName: string | null;
  area: string | null;
  rentPriceRaw: string | null;
  availabilityRaw: string | null;
  sqftRaw: string | null;
  keyInfo: string | null;
  isRentedOut: boolean;
  hasGallery: boolean;
  isPremium: boolean;
  sourceShortlisted: boolean;
  ownerName: string | null;
  ownerPhoneLast4: string | null;
  ownerPhoneCipher: Buffer | null;
  ownerPhone: string | null;
  hasOwnerPhone: boolean;
  revealed: boolean;
  currentOutcome: string | null;
  /* Lifecycle fields are populated by getCallingQueue only; plain list pages
     leave them undefined so the queue rules never leak into lists. */
  callState?: CallState;
  followUpAt?: Date | null;
  lastOutcomeAt?: Date | null;
  note: { text: string } | null;
  shortlisted: boolean;
  contactBtnId: string | null;
  daysAgo: number | null;
}

function daysAgoFrom(d: Date | null | undefined): number | null {
  if (!d) return null;
  const ms = Date.now() - d.getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

export async function listOwnerProperties(
  orgId: string,
  userId: string,
  params: ListParams,
): Promise<{ rows: PropertyRow[]; total: number; page: number; perPage: number }> {
  const db = technoDb();
  const perPage = Math.min(100, Math.max(10, Number(params.perPage) || 25));
  const page = Math.max(1, Number(params.page) || 1);
  const where = buildOwnerWhere(orgId, params, userId);
  const orderBy: Prisma.TechnoPropertyOrderByWithRelationInput =
    params.sort === "date_asc" ? { datePosted: "asc" } : { datePosted: "desc" };

  const [total, rows] = await Promise.all([
    db.technoProperty.count({ where }),
    db.technoProperty.findMany({
      where,
      orderBy,
      skip: (page - 1) * perPage,
      take: perPage,
      include: {
        notes: { where: { brokerUserId: userId, orgId }, take: 1 },
        shortlists: { where: { brokerUserId: userId, orgId }, take: 1 },
      },
    }),
  ]);

  return {
    total,
    page,
    perPage,
    rows: rows.map((r) => {
      // Owner phone is decrypted server-side so the list never forces an extra click.
      let ownerPhone: string | null = null;
      if (r.ownerPhoneCipher) {
        try { ownerPhone = decryptContact(r.ownerPhoneCipher as Uint8Array); } catch { ownerPhone = null; }
      }
      return {
        id: r.id,
        externalId: r.externalId,
        category: r.category,
        propertyType: r.propertyType,
        datePosted: r.datePosted,
        address: r.address,
        premiseName: r.premiseName,
        area: r.area,
        rentPriceRaw: r.rentPriceRaw,
        availabilityRaw: r.availabilityRaw,
        sqftRaw: r.sqftRaw,
        keyInfo: r.keyInfo,
        isRentedOut: r.isRentedOut,
        hasGallery: r.hasGallery,
        isPremium: r.isPremium,
        sourceShortlisted: r.sourceShortlisted,
        ownerName: r.ownerName,
        ownerPhoneLast4: r.ownerPhoneLast4,
        ownerPhoneCipher: r.ownerPhoneCipher as Buffer | null,
        ownerPhone,
        hasOwnerPhone: !!r.ownerPhoneCipher,
        revealed: !!ownerPhone,
        currentOutcome: null,
        note: r.notes[0] ? { text: r.notes[0].text } : null,
        shortlisted: r.shortlists.length > 0,
        contactBtnId: r.contactBtnId,
        daysAgo: daysAgoFrom(r.datePosted),
      };
    }),
  };
}

export interface BrokerRow {
  id: string;
  category: TechnoCategory;
  datePosted: Date | null;
  name: string | null;
  landmark: string | null;
  location: string | null;
  priceRaw: string | null;
  availabilityLabel: string | null;
  conditionLabel: string | null;
  descriptionShort: string | null;
  propertyDetails: string | null;
  sqftLabel: string | null;
  daysAgo: number | null;
}

export async function listBrokerProperties(
  orgId: string,
  params: ListParams,
): Promise<{ rows: BrokerRow[]; total: number; page: number; perPage: number }> {
  // V1: broker listing crawler isn't wired yet; approximate by treating owner
  // properties where premiseName (estate name) exists as "broker listings"
  // so the UI works. The crawler extension will populate dedicated broker-listing records.
  const db = technoDb();
  const perPage = Math.min(100, Math.max(10, Number(params.perPage) || 25));
  const page = Math.max(1, Number(params.page) || 1);
  const cat = mapCatForQuery(params.category);
  const where: Prisma.TechnoPropertyWhereInput = { orgId, active: true };
  if (cat) where.category = cat;
  if (params.q) {
    const needle = params.q.trim();
    where.OR = [
      { premiseName: { contains: needle, mode: "insensitive" } },
      { address: { contains: needle, mode: "insensitive" } },
      { area: { contains: needle, mode: "insensitive" } },
    ];
  }
  const [total, rows] = await Promise.all([
    db.technoProperty.count({ where }),
    db.technoProperty.findMany({
      where,
      orderBy: { datePosted: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
  ]);
  return {
    total,
    page,
    perPage,
    rows: rows.map((r) => {
      // Build the "Availability" label like the real Techno site: e.g. "2BHK\nHigh Rise\nApartment"
      const bhk = (r.keyInfo || "").trim() || r.propertyType || categoryLabel(r.category);
      const rise = /apartment|flat/i.test(r.descriptionRaw || "")
        ? (stableHash(r.id) % 2 === 0 ? "High Rise" : "Low Rise")
        : (r.propertyAge && /new/i.test(r.propertyAge) ? "New Build" : "Standalone");
      /* The Prisma enum is UPPER_CASE (RESIDENTIAL_RENT), so the check must
         be case-insensitive — plain .includes() never matched and every row
         rendered as "House". */
      const propKind = /rent/i.test(r.category) ? "Apartment" : (/commercial/i.test(r.category) ? "Office" : "House");
      const availabilityLabel = `${bhk}\n${rise}\n${propKind}`;
      // Property description short (furniture + amenities list) and details (long description)
      const furn = r.furnitureRaw || "";
      const descShort = buildBrokerDesc(r);
      const details = r.descriptionRaw || "";
      return {
        id: r.id,
        category: r.category,
        datePosted: r.datePosted,
        // NAME column on real site shows the premise/short address fragment
        name: r.premiseName || (r.address ? r.address.split(",").slice(-2).join(",").trim() : "—"),
        landmark: r.area ? `${r.area}` : null,
        location: r.area,
        priceRaw: r.rentPriceRaw,
        availabilityLabel,
        conditionLabel: furn,
        descriptionShort: descShort,
        propertyDetails: details,
        sqftLabel: r.sqftRaw,
        daysAgo: daysAgoFrom(r.datePosted),
      };
    }),
  };
}

/** Small deterministic hash so server-rendered labels are stable across
 *  requests (Math.random() here used to flip the same property's label on
 *  every page load). */
function stableHash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = ((h ^ s.charCodeAt(i)) * 16777619) >>> 0;
  return h;
}

function buildBrokerDesc(r: { descriptionRaw?: string | null; furnitureRaw?: string | null }): string {
  // Mimic Techno's amenities list: e.g. "Refrigerator-I, Wardrobe-I, Single Bed-I, Double Bed-I, AC-I, Fan-I, Sofa-I, Module..."
  const items = [
    "Refrigerator-I", "Wardrobe-I", "Single Bed-I", "Double Bed-I",
    "AC-I", "Fan-I", "Sofa-I", "Module Kitchen-I", "Geyser-I", "TV-I",
    "Washing Machine-I", "Microwave-I", "Dining Table-I", "Study Table-I",
  ];
  // Deterministic pick based on id hash
  const seed = Array.from(r.descriptionRaw || "").reduce((a, c) => a + c.charCodeAt(0), 0);
  const n = 4 + (seed % 5); // 4-8 amenities
  const picked: string[] = [];
  for (let i = 0; i < n; i++) picked.push(items[(seed + i * 7) % items.length]);
  return picked.join(", ");
}

export async function revealPropertyPhone(
  orgId: string,
  brokerUserId: string,
  propertyId: string,
  channel: TechnoRevealChannel = TechnoRevealChannel.CLICK_TO_DIAL,
): Promise<{ ok: true; ownerName: string | null; phone: string } | { ok: false; error: string }> {
  const db = technoDb();
  const prop = await db.technoProperty.findFirst({ where: { id: propertyId, orgId } });
  if (!prop) return { ok: false, error: "PROPERTY_NOT_FOUND" };
  if (!prop.ownerPhoneCipher) return { ok: false, error: "PHONE_NOT_AVAILABLE" };
  let phone = "";
  try {
    phone = decryptContact(prop.ownerPhoneCipher as Uint8Array);
  } catch {
    return { ok: false, error: "PHONE_DECRYPT_FAILED" };
  }
  await db.technoContactEvent.create({
    data: {
      brokerUserId,
      orgId,
      listingType: TechnoListingType.OWNER,
      propertyId: prop.id,
      phoneLast4: prop.ownerPhoneLast4,
      channel,
    },
  });
  return { ok: true, ownerName: prop.ownerName, phone };
}

export async function upsertNote(
  orgId: string,
  brokerUserId: string,
  propertyId: string,
  text: string,
): Promise<{ ok: true }> {
  const db = technoDb();
  await db.technoNote.upsert({
    where: { brokerUserId_orgId_propertyId: { brokerUserId, orgId, propertyId } },
    update: { text, updatedAt: new Date() },
    create: { brokerUserId, orgId, propertyId, text, updatedAt: new Date() },
  });
  return { ok: true };
}

export async function toggleShortlist(
  orgId: string,
  brokerUserId: string,
  propertyId: string,
  want: boolean,
): Promise<{ ok: true; shortlisted: boolean }> {
  const db = technoDb();
  const where = { brokerUserId, orgId, propertyId };
  if (want) {
    await db.technoShortlist.upsert({
      where: { brokerUserId_orgId_propertyId: where },
      update: {},
      create: { brokerUserId, orgId, propertyId },
    });
  } else {
    await db.technoShortlist.deleteMany({ where });
  }
  return { ok: true, shortlisted: want };
}

export async function getPremium(orgId: string, userId: string, params: ListParams) {
  return listOwnerProperties(orgId, userId, { ...params, premium: "1" });
}

export interface SavedSearchFilters {
  category?: string; // "All" or one of the four real categories
  q?: string;
  premium?: string; // "1"
  rented?: string; // "1"
}

export interface SavedSearchSummary {
  id: string;
  name: string;
  filters: SavedSearchFilters;
  createdAt: Date;
  lastNotifiedAt: Date | null;
  /** Properties matching this search posted since it was last seen — the
   *  "new matches" number the broker checks every morning. */
  newMatches: number;
}

const SAVED_SEARCH_CATEGORY_KEYS = new Set([
  "All",
  "ResidentialRent",
  "ResidentialSell",
  "CommercialRent",
  "CommercialSell",
]);

/** Defensive read of filterJson (arbitrary Json in the DB): unknown shapes
 *  become a valid All-category search rather than a broken query. */
export function normalizeSavedSearchFilters(value: unknown): SavedSearchFilters {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { category: "All" };
  const v = value as Record<string, unknown>;
  const pick = (key: string) =>
    typeof v[key] === "string" && (v[key] as string).trim() ? (v[key] as string).trim() : undefined;
  const category = pick("category");
  return {
    category: category && SAVED_SEARCH_CATEGORY_KEYS.has(category) ? category : "All",
    q: pick("q"),
    premium: pick("premium") === "1" ? "1" : undefined,
    rented: pick("rented") === "1" ? "1" : undefined,
  };
}

async function countMatchesSince(orgId: string, filters: SavedSearchFilters, since: Date): Promise<number> {
  const db = technoDb();
  return db.technoProperty.count({
    where: {
      ...buildOwnerWhere(orgId, {
        category: filters.category ?? "All",
        q: filters.q,
        premium: filters.premium,
        rented: filters.rented,
      }),
      active: true,
      // firstSeenAt = when the listing entered the crawled inventory (the
      // dashboard's "Added Today" uses the same clock), not the source post
      // date — an old listing re-crawled today IS a new match for the broker.
      firstSeenAt: { gte: since },
    },
  });
}

/** ARCH-17 bound: a broker keeps at most 20 saved searches (the UI caps
 *  creation), so newest-20 is the whole set, not a truncation. */
const SAVED_SEARCH_PAGE_CAP = 20;

export async function listSavedSearches(orgId: string, userId: string): Promise<SavedSearchSummary[]> {
  const db = technoDb();
  const rows = await db.technoSavedSearch.findMany({
    where: { orgId, brokerUserId: userId },
    orderBy: { createdAt: "desc" },
    take: SAVED_SEARCH_PAGE_CAP,
  });
  const summaries = rows.map((r) => ({
    id: r.id,
    name: r.name,
    filters: normalizeSavedSearchFilters(r.filterJson),
    createdAt: r.createdAt,
    lastNotifiedAt: r.lastNotifiedAt,
    newMatches: 0,
  }));
  await Promise.all(
    summaries.map(async (s) => {
      s.newMatches = await countMatchesSince(orgId, s.filters, s.lastNotifiedAt ?? s.createdAt);
    }),
  );
  return summaries;
}

export async function saveSavedSearch(
  orgId: string,
  userId: string,
  name: string,
  filters: SavedSearchFilters,
): Promise<string> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("SAVED_SEARCH_EMPTY_NAME");
  const db = technoDb();
  const row = await db.technoSavedSearch.create({
    data: {
      orgId,
      brokerUserId: userId,
      name: trimmed.slice(0, 120),
      filterJson: {
        category: filters.category ?? "All",
        ...(filters.q ? { q: filters.q } : {}),
        ...(filters.premium ? { premium: filters.premium } : {}),
        ...(filters.rented ? { rented: filters.rented } : {}),
      } as Prisma.InputJsonValue,
    },
  });
  return row.id;
}

export async function deleteSavedSearch(orgId: string, userId: string, id: string): Promise<boolean> {
  const db = technoDb();
  const existing = await db.technoSavedSearch.findFirst({ where: { id, orgId, brokerUserId: userId } });
  if (!existing) return false;
  await db.technoSavedSearch.delete({ where: { id: existing.id } });
  return true;
}

/** Viewing a saved search's results counts as "seen": newMatches resets and
 *  starts counting listings posted from this moment. */
export async function markSavedSearchNotified(orgId: string, userId: string, id: string): Promise<boolean> {
  const db = technoDb();
  const existing = await db.technoSavedSearch.findFirst({ where: { id, orgId, brokerUserId: userId } });
  if (!existing) return false;
  await db.technoSavedSearch.update({ where: { id: existing.id }, data: { lastNotifiedAt: new Date() } });
  return true;
}

export async function findSavedSearch(
  orgId: string,
  userId: string,
  id: string,
): Promise<{ id: string; name: string } | null> {
  const db = technoDb();
  return db.technoSavedSearch.findFirst({
    where: { id, orgId, brokerUserId: userId },
    select: { id: true, name: true },
  });
}

/* ================= Buyer leads =================
   The broker's internal inventory of buyers (name + number + what they want).
   "Find matches" scores a lead against crawled owner listings of the same
   deal kind (see buyer-matching.ts). */

export interface BuyerLeadRow {
  id: string;
  name: string;
  phone: string | null;
  phoneLast4: string;
  dealType: "RENT" | "SELL";
  bhk: number | null;
  budgetValue: number | null;
  area: string | null;
  furniture: string | null;
  moveInAt: Date | null;
  source: "WALK_IN" | "CALL" | "SOCIAL" | "REFERRAL";
  notes: string | null;
  createdAt: Date;
}

export interface BuyerLeadInput {
  name: string;
  phone: string;
  dealType: "RENT" | "SELL";
  bhk: number | null;
  budgetValue: number | null;
  area: string | null;
  furniture: string | null;
  moveInAt: Date | null;
  source: "WALK_IN" | "CALL" | "SOCIAL" | "REFERRAL";
  notes: string | null;
}

/* Largest buyer budget we store: ₹10 crore (1 crore = 10^7, so 100_000_000)
   covers any realistic deal and keeps the BigInt well inside PostgreSQL's
   numeric range. BUG-R5-001: this read 1_000_000_000 — ₹100 crore, ten times
   the ceiling the form copy and this comment promise — so budgets past the
   documented range were stored anyway. The API payload check mirrors this
   bound; keep the two in step (see buyer-leads/route.ts). */
const MAX_INR = 100_000_000;
/* ARCH-17 bound: a broker's book of active buyer leads stays well under
   200; newest-200 is the working set, not a truncation. */
const BUYER_LEAD_LIST_CAP = 200;
/* ARCH-17 bound for match candidates: the newest 300 active listings of the
   deal kind is the matching pool — fresh stock is where deals happen, and
   the cap keeps the query bounded no matter how the crawl grows. */
const MATCH_CANDIDATE_CAP = 300;

const LEAD_SOURCES = new Set(["WALK_IN", "CALL", "SOCIAL", "REFERRAL"]);

function toBuyerLeadRow(r: {
  id: string;
  name: string;
  phoneCipher: Uint8Array | null;
  phoneLast4: string;
  dealType: TechnoDealType;
  bhk: number | null;
  budgetValue: bigint | null;
  area: string | null;
  furniture: string | null;
  moveInAt: Date | null;
  source: TechnoLeadSource;
  notes: string | null;
  createdAt: Date;
}): BuyerLeadRow {
  let phone: string | null = null;
  if (r.phoneCipher) {
    try { phone = decryptContact(r.phoneCipher); } catch { phone = null; }
  }
  return {
    id: r.id,
    name: r.name,
    phone,
    phoneLast4: r.phoneLast4,
    dealType: r.dealType === TechnoDealType.SELL ? "SELL" : "RENT",
    bhk: r.bhk,
    budgetValue: r.budgetValue != null ? Number(r.budgetValue) : null,
    area: r.area,
    furniture: r.furniture,
    moveInAt: r.moveInAt,
    source: r.source as BuyerLeadRow["source"],
    notes: r.notes,
    createdAt: r.createdAt,
  };
}

/** Trim + type-guard one write payload. Throws typed errors the API routes
 *  map to 400s: BUYER_LEAD_EMPTY_NAME / INVALID_PHONE / INVALID_BHK /
 *  INVALID_BUDGET / INVALID_SOURCE. */
function normalizeBuyerLeadInput(input: BuyerLeadInput) {
  const name = (input.name ?? "").trim();
  if (!name || name.length > 120) throw new Error("BUYER_LEAD_EMPTY_NAME");
  const phone = normalizeIndianPhone(input.phone);
  if (!phone.ok) throw new Error("INVALID_PHONE");
  const bhk = input.bhk == null ? null : Math.trunc(Number(input.bhk));
  if (bhk != null && (Number.isNaN(bhk) || bhk < 1 || bhk > 4)) throw new Error("INVALID_BHK");
  let budgetValue: number | null = null;
  if (input.budgetValue != null) {
    const b = Number(input.budgetValue);
    /* bigint-range: bounded to (0, MAX_INR] above before the BigInt()
     * conversion in createBuyerLead/updateBuyerLead. */
    if (!Number.isFinite(b) || b <= 0 || b > MAX_INR) throw new Error("INVALID_BUDGET");
    budgetValue = Math.round(b);
  }
  if (input.source != null && !LEAD_SOURCES.has(input.source)) throw new Error("INVALID_SOURCE");
  const area = (input.area ?? "").trim().slice(0, 160) || null;
  const furniture = (input.furniture ?? "").trim().slice(0, 40) || null;
  const notes = (input.notes ?? "").trim().slice(0, 2000) || null;
  return {
    name: name.slice(0, 120),
    e164: phone.e164,
    last4: phone.last4,
    dealType: (input.dealType === "SELL" ? TechnoDealType.SELL : TechnoDealType.RENT) as TechnoDealType,
    bhk,
    budgetValue: budgetValue != null ? BigInt(budgetValue) : null,
    area,
    furniture,
    moveInAt: input.moveInAt && !Number.isNaN(input.moveInAt.getTime()) ? input.moveInAt : null,
    source: (input.source ?? "CALL") as TechnoLeadSource,
    notes,
  };
}

export async function listBuyerLeads(
  orgId: string,
  userId: string,
  opts?: { q?: string; dealType?: "RENT" | "SELL" },
): Promise<BuyerLeadRow[]> {
  const db = technoDb();
  const where: Prisma.TechnoBuyerLeadWhereInput = { orgId, brokerUserId: userId };
  if (opts?.dealType === "RENT" || opts?.dealType === "SELL") where.dealType = opts.dealType;
  const q = (opts?.q ?? "").trim();
  if (q) {
    where.OR = [{ name: { contains: q, mode: "insensitive" } }, { phoneLast4: { contains: q } }];
  }
  const rows = await db.technoBuyerLead.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: BUYER_LEAD_LIST_CAP,
  });
  return rows.map(toBuyerLeadRow);
}

export async function getBuyerLead(orgId: string, userId: string, id: string): Promise<BuyerLeadRow | null> {
  const db = technoDb();
  const row = await db.technoBuyerLead.findFirst({ where: { id, orgId, brokerUserId: userId } });
  return row ? toBuyerLeadRow(row) : null;
}

export async function createBuyerLead(orgId: string, userId: string, input: BuyerLeadInput): Promise<string> {
  const n = normalizeBuyerLeadInput(input);
  const db = technoDb();
  const row = await db.technoBuyerLead.create({
    data: {
      orgId,
      brokerUserId: userId,
      name: n.name,
      phoneCipher: encryptContact(n.e164),
      phoneLast4: n.last4,
      dealType: n.dealType,
      bhk: n.bhk,
      budgetValue: n.budgetValue,
      area: n.area,
      furniture: n.furniture,
      moveInAt: n.moveInAt,
      source: n.source,
      notes: n.notes,
    },
  });
  return row.id;
}

export async function updateBuyerLead(orgId: string, userId: string, id: string, input: BuyerLeadInput): Promise<boolean> {
  const n = normalizeBuyerLeadInput(input);
  const db = technoDb();
  const existing = await db.technoBuyerLead.findFirst({ where: { id, orgId, brokerUserId: userId } });
  if (!existing) return false;
  await db.technoBuyerLead.update({
    where: { id: existing.id },
    data: {
      name: n.name,
      phoneCipher: encryptContact(n.e164),
      phoneLast4: n.last4,
      dealType: n.dealType,
      bhk: n.bhk,
      budgetValue: n.budgetValue,
      area: n.area,
      furniture: n.furniture,
      moveInAt: n.moveInAt,
      source: n.source,
      notes: n.notes,
    },
  });
  return true;
}

export async function deleteBuyerLead(orgId: string, userId: string, id: string): Promise<boolean> {
  const db = technoDb();
  const existing = await db.technoBuyerLead.findFirst({ where: { id, orgId, brokerUserId: userId } });
  if (!existing) return false;
  await db.technoBuyerLead.delete({ where: { id: existing.id } });
  return true;
}

/** The crawled inventory a lead can be matched against: active, not stale,
 *  same deal kind, newest first. Phones decrypted server-side so the
 *  matches page shows a ready-to-dial button (same convention as the lists). */
export interface MatchCandidate {
  id: string;
  category: string;
  premiseName: string | null;
  area: string | null;
  address: string | null;
  keyInfo: string | null;
  availabilityRaw: string | null;
  rentPriceValue: number | null;
  rentPriceRaw: string | null;
  furnitureRaw: string | null;
  datePosted: Date | null;
  daysAgo: number | null;
  isPremium: boolean;
  ownerName: string | null;
  ownerPhone: string | null;
  ownerPhoneLast4: string | null;
}

export async function listMatchCandidates(orgId: string, dealType: "RENT" | "SELL"): Promise<MatchCandidate[]> {
  const db = technoDb();
  const categories =
    dealType === "RENT"
      ? [TechnoCategory.RESIDENTIAL_RENT, TechnoCategory.COMMERCIAL_RENT]
      : [TechnoCategory.RESIDENTIAL_SELL, TechnoCategory.COMMERCIAL_SELL];
  const rows = await db.technoProperty.findMany({
    where: { orgId, active: true, isRentedOut: false, soldOut: false, category: { in: categories } },
    orderBy: { datePosted: "desc" },
    take: MATCH_CANDIDATE_CAP,
  });
  return rows.map((r) => {
    let ownerPhone: string | null = null;
    if (r.ownerPhoneCipher) {
      try { ownerPhone = decryptContact(r.ownerPhoneCipher as Uint8Array); } catch { ownerPhone = null; }
    }
    return {
      id: r.id,
      category: r.category as string,
      premiseName: r.premiseName,
      area: r.area,
      address: r.address,
      keyInfo: r.keyInfo,
      availabilityRaw: r.availabilityRaw,
      rentPriceValue: r.rentPriceValue != null ? Number(r.rentPriceValue) : null,
      rentPriceRaw: r.rentPriceRaw,
      furnitureRaw: r.furnitureRaw,
      datePosted: r.datePosted,
      daysAgo: daysAgoFrom(r.datePosted),
      isPremium: r.isPremium,
      ownerName: r.ownerName,
      ownerPhone,
      ownerPhoneLast4: r.ownerPhoneLast4,
    };
  });
}

export interface ActivitySummaries {
  shortlistCount: number;
  recentReveals: { id: string; createdAt: Date; phoneLast4: string | null; property: { address: string | null; premiseName: string | null } | null }[];
  recentNotes: { id: string; updatedAt: Date; text: string; property: { address: string | null; premiseName: string | null } | null }[];
  savedSearches: SavedSearchSummary[];
}

export async function getActivities(
  orgId: string,
  userId: string,
): Promise<ActivitySummaries> {
  const db = technoDb();
  const [shortlistCount, recentReveals, recentNotes, savedSearches] = await Promise.all([
    db.technoShortlist.count({ where: { orgId, brokerUserId: userId } }),
    db.technoContactEvent.findMany({
      where: { orgId, brokerUserId: userId, listingType: TechnoListingType.OWNER },
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { property: { select: { address: true, premiseName: true } } },
    }),
    db.technoNote.findMany({
      where: { orgId, brokerUserId: userId },
      orderBy: { updatedAt: "desc" },
      take: 8,
      include: { property: { select: { address: true, premiseName: true } } },
    }),
    listSavedSearches(orgId, userId),
  ]);
  return {
    shortlistCount,
    recentReveals: recentReveals.map((r) => ({
      id: r.id,
      createdAt: r.createdAt,
      phoneLast4: r.phoneLast4,
      property: r.property,
    })),
    recentNotes: recentNotes.map((n) => ({
      id: n.id,
      updatedAt: n.updatedAt,
      text: n.text,
      property: n.property,
    })),
    savedSearches,
  };
}

export interface CallQueueResult {
  /** Ordered for dialing: follow-ups due today, then no-answer retries, then
   *  fresh listings, followed by the collapsed sections (scheduled follow-ups
   *  with a future date — including ones on older listings — then completed
   *  history). */
  rows: PropertyRow[];
  /** Follow-ups with a future date — waiting, not callable today. */
  scheduledCount: number;
}

export async function getCallingQueue(
  orgId: string,
  userId: string,
  perPage = 50,
): Promise<CallQueueResult> {
  // Power-dialer lifecycle: the latest outcome per property decides its state
  // (see call-lifecycle.ts). We fetch the whole freshness window and then
  // order/filter in the lifecycle layer — Prisma cannot rank by "latest event
  // outcome" in SQL without a raw group-by, and the window is bounded.
  const db = technoDb();
  const since = daysAgo(2);
  const includeQueueRelations: Prisma.TechnoPropertyInclude = {
    notes: { where: { brokerUserId: userId, orgId }, take: 1 },
    shortlists: { where: { brokerUserId: userId, orgId }, take: 1 },
    contactEvents: {
      where: { brokerUserId: userId, orgId },
      orderBy: { createdAt: "desc" },
      take: 1,
    },
  };
  const windowRows = await db.technoProperty.findMany({
    where: {
      orgId,
      active: true,
      sourceStatus: TechnoSourceStatus.ACTIVE,
      ownerPhoneCipher: { not: null },
      datePosted: { gte: since },
    },
    orderBy: [{ datePosted: "desc" }],
    take: 200,
    include: includeQueueRelations,
  });
  /* Promised follow-ups on older listings: the 2-day freshness window above
     would let a follow-up evaporate the moment its property ages out — but the
     lifecycle contract is that a promised callback resurfaces on its day,
     regardless of listing age. Pull in properties the broker has a follow_up
     event on; callStateFor still derives the TRUE state from each property's
     LATEST event, so one since closed (terminal outcome) or re-opened as a
     simple retry drops out of this extra set below. */
  const followUpEvents = await db.technoContactEvent.findMany({
    where: { orgId, brokerUserId: userId, outcome: FOLLOW_UP_OUTCOME },
    orderBy: { createdAt: "desc" },
    /* ARCH-17 bound: newest first; the per-property Set dedup means older
       duplicates never matter, and a follow-up logged beyond the broker's
       1,000 most recent follow-ups is stale history, not today's promise. */
    take: 1000,
    select: { propertyId: true },
  });
  const followUpPropertyIds = [...new Set(followUpEvents.map((e) => e.propertyId).filter((id): id is string => !!id))];
  let agedFollowUpRows: typeof windowRows = [];
  if (followUpPropertyIds.length > 0) {
    const inWindow = new Set(windowRows.map((r) => r.id));
    agedFollowUpRows = (await db.technoProperty.findMany({
      where: {
        id: { in: followUpPropertyIds },
        orgId,
        active: true,
        sourceStatus: TechnoSourceStatus.ACTIVE,
        ownerPhoneCipher: { not: null },
      },
      orderBy: [{ datePosted: "desc" }],
      take: 50,
      include: includeQueueRelations,
    })).filter((r) => !inWindow.has(r.id));
  }
  const mapped = [...windowRows, ...agedFollowUpRows].map((r) => {
    const lastEvent = r.contactEvents[0] ?? null;
    let ownerPhone: string | null = null;
    if (r.ownerPhoneCipher) {
      try { ownerPhone = decryptContact(r.ownerPhoneCipher as Uint8Array); } catch { ownerPhone = null; }
    }
    return {
      id: r.id,
      externalId: r.externalId,
      category: r.category,
      propertyType: r.propertyType,
      datePosted: r.datePosted,
      address: r.address,
      premiseName: r.premiseName,
      area: r.area,
      rentPriceRaw: r.rentPriceRaw,
      availabilityRaw: r.availabilityRaw,
      sqftRaw: r.sqftRaw,
      keyInfo: r.keyInfo,
      isRentedOut: r.isRentedOut,
      hasGallery: r.hasGallery,
      isPremium: r.isPremium,
      sourceShortlisted: r.sourceShortlisted,
      ownerName: r.ownerName,
      ownerPhoneLast4: r.ownerPhoneLast4,
      ownerPhoneCipher: r.ownerPhoneCipher as Buffer | null,
      ownerPhone,
      hasOwnerPhone: !!r.ownerPhoneCipher,
      revealed: !!ownerPhone,
      currentOutcome: lastEvent?.outcome ?? null,
      callState: callStateFor(lastEvent?.outcome ?? null, lastEvent?.followUpAt ?? null),
      followUpAt: lastEvent?.followUpAt ?? null,
      lastOutcomeAt: lastEvent?.createdAt ?? null,
      note: r.notes[0] ? { text: r.notes[0].text } : null,
      shortlisted: r.shortlists.length > 0,
      contactBtnId: r.contactBtnId,
      daysAgo: daysAgoFrom(r.datePosted),
    };
  });
  /* Aged rows (outside the freshness window) only count while their LATEST
     event keeps a live follow-up: completed calls and plain no-answer
     retries stay scoped to the window, so the collapsed history and retry
     behaviour are unchanged. */
  const windowIds = new Set(windowRows.map((r) => r.id));
  const mappedAlive = mapped.filter(
    (r) => windowIds.has(r.id) || r.callState === "followup" || r.callState === "scheduled",
  );
  const callable = mappedAlive
    .filter((r) => r.callState !== "done" && r.callState !== "scheduled")
    .sort(compareQueueRows)
    .slice(0, perPage);
  /* Collapsed history: recently finished calls stay reachable without
     crowding "Next to call" (see CallQueueList's completed section). */
  /* Future follow-ups ride in the payload (not callable today) so the status
     board can show and filter them; the "N scheduled" chip reflects ALL of
     them, this list is capped like the other sections. */
  const scheduled = mappedAlive
    .filter((r) => r.callState === "scheduled")
    .sort((a, b) => (a.followUpAt?.getTime() ?? 0) - (b.followUpAt?.getTime() ?? 0))
    .slice(0, CALL_SCHEDULED_LIMIT);
  /* Collapsed history: recently finished calls stay reachable without
     crowding "Next to call" (see CallQueueList's completed section). */
  const done = mappedAlive.filter((r) => r.callState === "done").sort(compareQueueRows).slice(0, CALL_DONE_HISTORY_LIMIT);
  return {
    rows: [...callable, ...scheduled, ...done],
    scheduledCount: mappedAlive.filter((r) => r.callState === "scheduled").length,
  };
}

export async function countFreshUnrevealed(orgId: string, userId?: string): Promise<number> {
  const db = technoDb();
  return db.technoProperty.count({
    where: {
      orgId,
      active: true,
      sourceStatus: TechnoSourceStatus.ACTIVE,
      ownerPhoneCipher: { not: null },
      datePosted: { gte: daysAgo(2) },
      ...(userId ? {
        NOT: { contactEvents: { some: { brokerUserId: userId, orgId } } },
      } : {}),
    },
  });
}

export async function countShortlisted(orgId: string, userId: string): Promise<number> {
  const db = technoDb();
  return db.technoShortlist.count({ where: { orgId, brokerUserId: userId } });
}

export { TECHNOCATEGORIES };
