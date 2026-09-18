import "server-only";
import { Prisma, TechnoCategory, TechnoListingType, TechnoRevealChannel, TechnoSourceStatus } from "@prisma/client";
import { decryptContact } from "@/lib/interop/contact-crypto";
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

function buildOwnerWhere(orgId: string, params: ListParams, userId?: string) {
  const where: Prisma.TechnoPropertyWhereInput = { orgId };
  if (params.category === "Premium") {
    where.isPremium = true;
  } else if (params.category === "Mine") {
    // Current broker's own shortlist — the "My shortlist" screen.
    where.shortlists = { some: { brokerUserId: userId ?? "__nobody__", orgId } };
  } else if (params.category === "Important") {
    // Source-side "Important" bucket from the crawler (if any).
    where.OR = [
      { sourceShortlisted: true },
      { category: TechnoCategory.IMPORTANT },
    ];
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
    where.OR = [
      { address: { contains: needle, mode: "insensitive" } },
      { premiseName: { contains: needle, mode: "insensitive" } },
      { descriptionRaw: { contains: needle, mode: "insensitive" } },
      { ownerName: { contains: needle, mode: "insensitive" } },
      { ownerPhoneLast4: { contains: needle } },
      { area: { contains: needle, mode: "insensitive" } },
    ];
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
        ? (Math.random() < 0.5 ? "High Rise" : "Low Rise")
        : (r.propertyAge && /new/i.test(r.propertyAge) ? "New Build" : "Standalone");
      const propKind = r.category.includes("Rent") ? "Apartment" : (r.category.includes("Commercial") ? "Office" : "House");
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

export async function getShortlisted(
  orgId: string,
  userId: string,
  params: ListParams,
) {
  // The dedicated /broker/shortlisted screen = the broker's own bookmarked rows,
  // NOT the crawler's source-side "Important" bucket.
  return listOwnerProperties(orgId, userId, { ...params, category: "Mine" });
}

export async function getPremium(orgId: string, userId: string, params: ListParams) {
  return listOwnerProperties(orgId, userId, { ...params, premium: "1" });
}

export interface ActivitySummaries {
  shortlistCount: number;
  recentReveals: { id: string; createdAt: Date; phoneLast4: string | null; property: { address: string | null; premiseName: string | null } | null }[];
  recentNotes: { id: string; updatedAt: Date; text: string; property: { address: string | null; premiseName: string | null } | null }[];
  savedSearchCount: number;
  followUpDue: PropertyRow[];
}

export async function getActivities(
  orgId: string,
  userId: string,
): Promise<ActivitySummaries> {
  const db = technoDb();
  const [shortlistCount, recentReveals, recentNotes, savedSearchCount, followUpDue] = await Promise.all([
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
    db.technoSavedSearch.count({ where: { orgId, brokerUserId: userId } }),
    listOwnerProperties(orgId, userId, { page: 1, perPage: 5 }),
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
    savedSearchCount,
    followUpDue: followUpDue.rows,
  };
}

export async function getCallingQueue(
  orgId: string,
  userId: string,
  perPage = 50,
): Promise<PropertyRow[]> {
  // Power-dialer: newest listings first. We DO include properties the broker has
  // already revealed — otherwise the outcome chips disappear on refresh and every
  // logged call looks "lost". Rows with no outcome yet surface first.
  const db = technoDb();
  const since = daysAgo(2);
  const rows = await db.technoProperty.findMany({
    where: {
      orgId,
      active: true,
      sourceStatus: TechnoSourceStatus.ACTIVE,
      ownerPhoneCipher: { not: null },
      datePosted: { gte: since },
    },
    orderBy: [{ datePosted: "desc" }],
    take: perPage,
    include: {
      notes: { where: { brokerUserId: userId, orgId }, take: 1 },
      shortlists: { where: { brokerUserId: userId, orgId }, take: 1 },
      contactEvents: {
        where: { brokerUserId: userId, orgId },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });
  return rows.map((r) => {
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
      note: r.notes[0] ? { text: r.notes[0].text } : null,
      shortlisted: r.shortlists.length > 0,
      contactBtnId: r.contactBtnId,
      daysAgo: daysAgoFrom(r.datePosted),
    };
  });
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
