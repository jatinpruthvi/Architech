#!/usr/bin/env node
/**
 * ETL: read the crawler's SQLite (data/technoproperty.db) and upsert into
 * Architech's Postgres (TechnoProperty / TechnoCategoryStat / TechnoCrawlRun).
 *
 * Run:
 *   node ops/crawlAutomation/lib/etl.mjs --from-sqlite=ops/crawlAutomation/data/technoproperty.db --org-id=<cuid>
 *
 * Requirements:
 *   - pnpm install in the repo root
 *   - DATABASE_URL set (e.g. via the repo's .env)
 */
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { createRequire } from "node:module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..", "..", "..");
dotenv.config({ path: path.join(repoRoot, ".env") });

// Pull TS modules through tsx registration (already available via devDeps).
const require = createRequire(import.meta.url);
const { PrismaClient } = require(path.join(
  repoRoot,
  "node_modules/@prisma/client",
));
const { PrismaPg } = require(path.join(
  repoRoot,
  "node_modules/@prisma/adapter-pg",
));
const { encryptContact } = require(path.join(
  repoRoot,
  "src/lib/interop/contact-crypto",
));
const {
  categoryKeyToEnum,
} = require(path.join(repoRoot, "src/lib/technoproperty/categories"));
const {
  parsePrice,
  parseSqft,
  parseDate,
  toLast4,
} = require(path.join(repoRoot, "src/lib/technoproperty/mappers"));

const args = process.argv.slice(2);
const getArg = (name) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
};

const sqlitePath = path.resolve(
  repoRoot,
  getArg("from-sqlite") || "ops/crawlAutomation/data/technoproperty.db",
);
const orgId = getArg("org-id");
if (!orgId) {
  console.error("Missing --org-id=<broker org id>");
  process.exit(2);
}
if (!fs.existsSync(sqlitePath)) {
  console.error(`SQLite not found at ${sqlitePath}`);
  process.exit(2);
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL not set");
  process.exit(2);
}

const sqlite = new DatabaseSync(sqlitePath, { readOnly: true });
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

const now = new Date();
const today0 = new Date(now);
today0.setUTCHours(0, 0, 0, 0);
const yesterday0 = new Date(today0);
yesterday0.setUTCDate(yesterday0.getUTCDate() - 1);
const d15 = new Date(today0);
d15.setUTCDate(d15.getUTCDate() - 15);

function toBool(v) {
  return v === 1 || v === true || v === "1";
}

function imageUrls(raw) {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : null;
  } catch {
    return null;
  }
}

function mapRow(row) {
  const phone = row.owner_phone ? String(row.owner_phone).replace(/\D/g, "") : null;
  const datePosted = parseDate(row.date_posted);
  const category = categoryKeyToEnum(row.category_key);
  const isRented = toBool(row.is_rented_out);
  const isSold = row.status && /sold/i.test(row.status) && !/rent/i.test(row.category_key);
  const cipher = phone && phone.length >= 10 ? encryptContact(phone) : null;
  return {
    externalId: row.property_id,
    orgId,
    category,
    propertyType: row.property_type || null,
    datePosted,
    address: row.address || null,
    premiseName: row.premise_name || null,
    area: row.area || null,
    rentPriceRaw: row.rent_price_raw || null,
    rentPriceValue: parsePrice(row.rent_price_raw),
    availabilityRaw: row.availability_raw || null,
    conditionRaw: row.condition_raw || null,
    propertyAge: row.property_age || null,
    descriptionRaw: row.description_raw || null,
    furnitureRaw: row.furniture_raw || null,
    sqftRaw: row.sqft_raw || null,
    sqftValue: parseSqft(row.sqft_raw),
    keyInfo: row.key_info || null,
    brokerage: row.brokerage || null,
    isRentedOut: isRented,
    soldOut: !!isSold,
    hasGallery: toBool(row.has_gallery),
    isPremium: toBool(row.is_premium) || category === "PREMIUM",
    sourceShortlisted: toBool(row.is_shortlisted) || category === "IMPORTANT",
    ownerName: row.owner_name || null,
    ownerPhoneCipher: cipher,
    ownerPhoneLast4: toLast4(phone),
    contactBtnId: row.contact_btn_id || null,
    imageUrls: imageUrls(row.image_urls),
    sourceStatus: isRented ? "RENTED_OUT" : isSold ? "SOLD" : toBool(row.active) ? "ACTIVE" : "REMOVED",
    firstSeenAt: new Date(row.first_seen_at),
    lastSeenAt: new Date(row.last_seen_at),
    lastModifiedAt: new Date(row.last_modified_at || row.last_seen_at),
    rowHash: row.row_hash,
    active: toBool(row.active ?? true),
  };
}

async function main() {
  // Import crawl run record (pick latest)
  const lastCrawl = sqlite
    .prepare(
      "SELECT * FROM crawls ORDER BY id DESC LIMIT 1",
    )
    .get();

  const crawlRun = await prisma.technoCrawlRun.create({
    data: {
      mode: lastCrawl?.mode || "manual",
      externalCrawlId: lastCrawl?.id ?? null,
      startedAt: lastCrawl?.started_at ? new Date(lastCrawl.started_at) : now,
      finishedAt: lastCrawl?.finished_at ? new Date(lastCrawl.finished_at) : now,
      status: lastCrawl?.status || "completed",
      totalProperties: lastCrawl?.total_properties || 0,
      newProperties: lastCrawl?.new_properties || 0,
      updatedProperties: lastCrawl?.updated_properties || 0,
      removedProperties: lastCrawl?.removed_properties || 0,
      contactsFetched: lastCrawl?.contacts_fetched || 0,
      imagesFetched: lastCrawl?.images_fetched || 0,
      errors: lastCrawl?.errors || 0,
    },
  });
  console.log(`[etl] created crawl run ${crawlRun.id} (external #${lastCrawl?.id})`);

  // Properties joined with category membership so we have category_key.
  // The crawler keeps the master row in `properties` and per-category links in
  // `property_listings`. We emit one TechnoProperty per (property, category)
  // pair. That duplicates addresses across categories but makes the per-category
  // lists trivial to query — just like TechnoProperty's own UI shows them.
  const rows = sqlite
    .prepare(
      `SELECT p.*, pl.category_key
       FROM properties p
       JOIN property_listings pl ON pl.property_id = p.property_id AND pl.active = 1
       ORDER BY p.first_seen_at ASC`,
    )
    .all();
  console.log(`[etl] rows from sqlite: ${rows.length}`);

  let nNew = 0;
  let nUpd = 0;
  for (const raw of rows) {
    const data = mapRow(raw);
    const existing = await prisma.technoProperty.findUnique({
      where: { orgId_externalId: { orgId: data.orgId, externalId: data.externalId } },
      select: { id: true, rowHash: true, categories: true },
    });
    if (!existing) {
      await prisma.technoProperty.create({ data });
      nNew++;
    } else if (existing.rowHash !== data.rowHash) {
      const { externalId, orgId: _o, ...rest } = data;
      await prisma.technoProperty.update({ where: { id: existing.id }, data: rest });
      nUpd++;
    }
  }

  // Mark properties that no longer appear anywhere as inactive.
  const activeIds = new Set(rows.map((r) => r.property_id));
  const dbActive = await prisma.technoProperty.findMany({
    where: { orgId, active: true },
    select: { externalId: true },
  });
  let nDeact = 0;
  for (const { externalId } of dbActive) {
    if (!activeIds.has(externalId)) {
      await prisma.technoProperty.update({
        where: { orgId_externalId: { orgId, externalId } },
        data: { active: false, sourceStatus: "REMOVED" },
      });
      nDeact++;
    }
  }

  // Aggregate category stats for this org.
  const cats = ["ResidentialRent", "ResidentialSell", "CommercialRent", "CommercialSell"];
  async function statFor(category, since, until) {
    const where = { orgId, active: true };
    if (category) where.category = categoryKeyToEnum(category);
    if (since) where.firstSeenAt = { ...(where.firstSeenAt || {}), gte: since };
    if (until) where.firstSeenAt = { ...(where.firstSeenAt || {}), lt: until };
    return prisma.technoProperty.count({ where });
  }

  const totalActive = await prisma.technoProperty.count({
    where: { orgId, active: true, sourceStatus: "ACTIVE" },
  });
  const totalToday = await statFor(null, today0, null);
  const totalYday = await prisma.technoProperty.count({
    where: { orgId, firstSeenAt: { gte: yesterday0, lt: today0 } },
  });
  const last15 = await prisma.technoProperty.count({
    where: { orgId, firstSeenAt: { gte: d15 } },
  });

  await prisma.technoCategoryStat.upsert({
    where: { orgId_categoryKey: { orgId, categoryKey: "TOTAL" } },
    update: { totalActive, todayCount: totalToday, yesterdayCount: totalYday, last15Days: last15, updatedAt: now },
    create: { orgId, categoryKey: "TOTAL", totalActive, todayCount: totalToday, yesterdayCount: totalYday, last15Days: last15, updatedAt: now },
  });

  for (const key of cats) {
    const [total, today, yday] = await Promise.all([
      statFor(key, null, null),
      statFor(key, today0, null),
      prisma.technoProperty.count({
        where: {
          orgId,
          category: categoryKeyToEnum(key),
          firstSeenAt: { gte: yesterday0, lt: today0 },
        },
      }),
    ]);
    await prisma.technoCategoryStat.upsert({
      where: { orgId_categoryKey: { orgId, categoryKey: key } },
      update: { totalActive: total, todayCount: today, yesterdayCount: yday, updatedAt: now },
      create: { orgId, categoryKey: key, totalActive: total, todayCount: today, yesterdayCount: yday, updatedAt: now },
    });
  }

  console.log(
    `[etl] done. new=${nNew}, updated=${nUpd}, deactivated=${nDeact}, total=${totalActive}`,
  );
  await prisma.$disconnect();
  sqlite.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
