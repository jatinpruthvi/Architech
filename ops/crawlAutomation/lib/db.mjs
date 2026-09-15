import Database from 'better-sqlite3';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync } from 'fs';

const __dir = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dir, '..', 'data');
mkdirSync(DATA_DIR, { recursive: true });

export function openDb(dbPath) {
  const db = new Database(dbPath || resolve(DATA_DIR, 'technoproperty.db'));
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  schema(db);
  return db;
}

function schema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS crawls (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      mode          TEXT    NOT NULL,
      started_at    TEXT    NOT NULL,
      finished_at   TEXT,
      status        TEXT    DEFAULT 'running',
      total_properties  INTEGER DEFAULT 0,
      new_properties    INTEGER DEFAULT 0,
      updated_properties INTEGER DEFAULT 0,
      removed_properties INTEGER DEFAULT 0,
      contacts_fetched   INTEGER DEFAULT 0,
      images_fetched     INTEGER DEFAULT 0,
      errors          INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS categories (
      key             TEXT PRIMARY KEY,
      display_name    TEXT NOT NULL,
      url             TEXT NOT NULL,
      ajax_url        TEXT NOT NULL,
      propertytype_guid TEXT,
      endpoint_type   TEXT NOT NULL DEFAULT 'main',
      property_count  INTEGER DEFAULT 0,
      last_crawled_at TEXT
    );

    CREATE TABLE IF NOT EXISTS properties (
      property_id     TEXT PRIMARY KEY,
      property_type   TEXT,
      date_posted     TEXT,
      address         TEXT,
      premise_name    TEXT,
      area            TEXT,
      rent_price_raw  TEXT,
      availability_raw TEXT,
      condition_raw   TEXT,
      property_age    TEXT,
      description_raw TEXT,
      furniture_raw   TEXT,
      sqft_raw        TEXT,
      key_info        TEXT,
      brokerage       TEXT,
      status          TEXT,
      is_rented_out   INTEGER DEFAULT 0,
      has_gallery     INTEGER DEFAULT 0,
      note_raw        TEXT,
      owner_name      TEXT,
      owner_phone     TEXT,
      contact_revealed_in_listing INTEGER DEFAULT 0,
      contact_btn_id  TEXT,
      contact_fetched_at TEXT,
      image_urls      TEXT,
      images_fetched_at TEXT,
      is_premium      INTEGER DEFAULT 0,
      is_shortlisted  INTEGER DEFAULT 0,
      first_seen_at   TEXT NOT NULL,
      last_seen_at    TEXT NOT NULL,
      last_modified_at TEXT,
      row_hash        TEXT NOT NULL,
      active          INTEGER DEFAULT 1,
      categories      TEXT DEFAULT '[]'
    );

    CREATE TABLE IF NOT EXISTS property_listings (
      property_id TEXT    NOT NULL,
      category_key TEXT   NOT NULL,
      crawl_id    INTEGER,
      row_hash    TEXT    NOT NULL,
      listed_at   TEXT    NOT NULL,
      last_seen_at TEXT   NOT NULL,
      active      INTEGER DEFAULT 1,
      PRIMARY KEY (property_id, category_key),
      FOREIGN KEY (category_key) REFERENCES categories(key),
      FOREIGN KEY (crawl_id) REFERENCES crawls(id)
    );

    CREATE TABLE IF NOT EXISTS changes (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      crawl_id    INTEGER NOT NULL,
      property_id TEXT    NOT NULL,
      change_type TEXT    NOT NULL,
      field_name  TEXT,
      old_value   TEXT,
      new_value   TEXT,
      occurred_at TEXT    NOT NULL,
      FOREIGN KEY (crawl_id) REFERENCES crawls(id)
    );

    CREATE INDEX IF NOT EXISTS idx_pl_category ON property_listings(category_key);
    CREATE INDEX IF NOT EXISTS idx_pl_active   ON property_listings(active);
    CREATE INDEX IF NOT EXISTS idx_p_active    ON properties(active);
    CREATE INDEX IF NOT EXISTS idx_p_contact   ON properties(contact_fetched_at);
    CREATE INDEX IF NOT EXISTS idx_p_images    ON properties(images_fetched_at);
    CREATE INDEX IF NOT EXISTS idx_changes_crawl ON changes(crawl_id);
  `);

  // migrations for pre-existing databases
  const propCols = db.prepare('PRAGMA table_info(properties)').all().map(c => c.name);
  if (!propCols.includes('contact_btn_id')) {
    db.exec('ALTER TABLE properties ADD COLUMN contact_btn_id TEXT');
  }
}

// ---------- helpers ----------

export function beginCrawl(db, mode) {
  const now = new Date().toISOString();
  const info = db.prepare('INSERT INTO crawls(mode, started_at) VALUES(?,?)').run(mode, now);
  return info.lastInsertRowid;
}

export function finishCrawl(db, crawlId, stats) {
  const now = new Date().toISOString();
  db.prepare(`UPDATE crawls SET finished_at=?, status='completed',
    total_properties=?, new_properties=?, updated_properties=?,
    removed_properties=?, contacts_fetched=?, images_fetched=?, errors=? WHERE id=?`)
    .run(now, stats.total||0, stats.new||0, stats.updated||0, stats.removed||0,
      stats.contacts||0, stats.images||0, stats.errors||0, crawlId);
}

export function failCrawl(db, crawlId) {
  const now = new Date().toISOString();
  db.prepare("UPDATE crawls SET finished_at=?, status='failed' WHERE id=?").run(now, crawlId);
}

export function upsertProperty(db, prop, crawlId) {
  prop.is_rented_out = prop.is_rented_out ? 1 : 0;
  prop.has_gallery = prop.has_gallery ? 1 : 0;
  prop.is_premium = prop.is_premium ? 1 : 0;
  prop.is_shortlisted = prop.is_shortlisted ? 1 : 0;
  const now = new Date().toISOString();
  const existing = db.prepare('SELECT row_hash, categories, active FROM properties WHERE property_id=?').get(prop.property_id);
  let changeType = null;
  const revealedNow = prop.owner_phone ? 1 : 0;
  const contactFetchedNow = prop.owner_phone ? now : null;

  if (!existing) {
    // NEW
    db.prepare(`INSERT INTO properties(
      property_id, property_type, date_posted, address, premise_name, area,
      rent_price_raw, availability_raw, condition_raw, property_age, description_raw,
      furniture_raw, sqft_raw, key_info, brokerage, status,
      is_rented_out, has_gallery, note_raw,
      owner_name, owner_phone, contact_revealed_in_listing, contact_btn_id, contact_fetched_at,
      is_premium, is_shortlisted,
      first_seen_at, last_seen_at, last_modified_at, row_hash, active, categories
    ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      prop.property_id, prop.property_type, prop.date_posted, prop.address,
      prop.premise_name, prop.area, prop.rent_price_raw, prop.availability_raw,
      prop.condition_raw, prop.property_age, prop.description_raw, prop.furniture_raw,
      prop.sqft_raw, prop.key_info, prop.brokerage, prop.status,
      prop.is_rented_out, prop.has_gallery, prop.note_raw,
      prop.owner_name, prop.owner_phone, revealedNow, prop.contact_btn_id, contactFetchedNow,
      prop.is_premium, prop.is_shortlisted,
      now, now, now, prop.row_hash, 1, JSON.stringify([prop.category_key])
    );
    changeType = 'new';
  } else if (existing.row_hash !== prop.row_hash) {
    // UPDATED
    const oldCats = JSON.parse(existing.categories || '[]');
    const newCats = oldCats.includes(prop.category_key) ? oldCats : [...oldCats, prop.category_key];
    db.prepare(`UPDATE properties SET
      property_type=?, date_posted=?, address=?, premise_name=?, area=?,
      rent_price_raw=?, availability_raw=?, condition_raw=?, property_age=?,
      description_raw=?, furniture_raw=?, sqft_raw=?, key_info=?, brokerage=?,
      status=?, is_rented_out=?, has_gallery=?, note_raw=?,
      contact_btn_id=COALESCE(?, contact_btn_id),
      owner_name=CASE WHEN ? > 0 THEN ? ELSE owner_name END,
      owner_phone=CASE WHEN ? > 0 THEN ? ELSE owner_phone END,
      contact_revealed_in_listing=CASE WHEN ? > 0 THEN 1 ELSE contact_revealed_in_listing END,
      contact_fetched_at=CASE WHEN ? > 0 THEN ? ELSE contact_fetched_at END,
      is_premium=?, is_shortlisted=?,
      last_seen_at=?, last_modified_at=?, row_hash=?, active=1, categories=?
      WHERE property_id=?`).run(
      prop.property_type, prop.date_posted, prop.address, prop.premise_name,
      prop.area, prop.rent_price_raw, prop.availability_raw, prop.condition_raw,
      prop.property_age, prop.description_raw, prop.furniture_raw, prop.sqft_raw,
      prop.key_info, prop.brokerage, prop.status, prop.is_rented_out, prop.has_gallery,
      prop.note_raw,
      prop.contact_btn_id, revealedNow, prop.owner_name, revealedNow, prop.owner_phone,
      revealedNow, revealedNow, revealedNow,
      prop.is_premium, prop.is_shortlisted,
      now, now, prop.row_hash, JSON.stringify(newCats), prop.property_id
    );
    changeType = 'updated';
  } else {
    // no change, just update last_seen, ensure active, and merge flags/categories
    const oldCats = JSON.parse(existing.categories || '[]');
    const newCats = oldCats.includes(prop.category_key) ? oldCats : [...oldCats, prop.category_key];
    db.prepare(`UPDATE properties SET
      last_seen_at=?, active=1,
      contact_btn_id=COALESCE(?, contact_btn_id),
      owner_name=CASE WHEN ? > 0 THEN ? ELSE owner_name END,
      owner_phone=CASE WHEN ? > 0 THEN ? ELSE owner_phone END,
      contact_revealed_in_listing=CASE WHEN ? > 0 THEN 1 ELSE contact_revealed_in_listing END,
      contact_fetched_at=CASE WHEN ? > 0 THEN ? ELSE contact_fetched_at END,
      is_premium=MAX(is_premium,?), is_shortlisted=MAX(is_shortlisted,?), categories=?
      WHERE property_id=?`).run(
      now, prop.contact_btn_id, revealedNow, prop.owner_name, revealedNow, prop.owner_phone,
      revealedNow, revealedNow, revealedNow,
      prop.is_premium, prop.is_shortlisted, JSON.stringify(newCats), prop.property_id
    );
  }

  // upsert listing record
  const existingListing = db.prepare('SELECT row_hash FROM property_listings WHERE property_id=? AND category_key=?')
    .get(prop.property_id, prop.category_key);
  if (!existingListing) {
    db.prepare('INSERT INTO property_listings(property_id, category_key, crawl_id, row_hash, listed_at, last_seen_at, active) VALUES(?,?,?,?,?,?,1)')
      .run(prop.property_id, prop.category_key, crawlId, prop.row_hash, now, now);
  } else {
    db.prepare('UPDATE property_listings SET row_hash=?, last_seen_at=?, crawl_id=?, active=1 WHERE property_id=? AND category_key=?')
      .run(prop.row_hash, now, crawlId, prop.property_id, prop.category_key);
  }

  return changeType;
}

export function markRemovedFromCategory(db, crawlId, categoryKey, currentPropIds) {
  // Deactivate listings for this category that are no longer present
  const placeholders = currentPropIds.map(() => '?').join(',');
  let removed = 0;
  if (currentPropIds.length > 0) {
    const gone = db.prepare(`SELECT property_id FROM property_listings WHERE category_key=? AND active=1 AND property_id NOT IN (${placeholders})`)
      .all(categoryKey, ...currentPropIds);
    if (gone.length > 0) {
      for (const g of gone) logChange(db, crawlId, g.property_id, 'removed', 'category', categoryKey, 'active=0');
      const info = db.prepare(`UPDATE property_listings SET active=0 WHERE category_key=? AND active=1 AND property_id NOT IN (${placeholders})`)
        .run(categoryKey, ...currentPropIds);
      removed = info.changes;
    }
  } else {
    const gone = db.prepare('SELECT property_id FROM property_listings WHERE category_key=? AND active=1').all(categoryKey);
    for (const g of gone) logChange(db, crawlId, g.property_id, 'removed', 'category', categoryKey, 'active=0');
    const info = db.prepare('UPDATE property_listings SET active=0 WHERE category_key=? AND active=1').run(categoryKey);
    removed = info.changes;
  }
  return removed;
}

export function reconcileActiveProperties(db) {
  // Bring properties.active and properties.categories in line with the active
  // listings. A property whose listings are all inactive becomes inactive and
  // keeps only the categories it has active listings in.
  db.exec(`
    UPDATE properties SET
      active = CASE WHEN EXISTS(
        SELECT 1 FROM property_listings pl WHERE pl.property_id = properties.property_id AND pl.active = 1
      ) THEN 1 ELSE 0 END,
      categories = (
        SELECT COALESCE(json_group_array(c.k), '[]')
        FROM (SELECT DISTINCT category_key AS k FROM property_listings
              WHERE property_id = properties.property_id AND active = 1) c
      );
  `);
}

export function logChange(db, crawlId, propId, changeType, fieldName, oldVal, newVal) {
  const now = new Date().toISOString();
  db.prepare('INSERT INTO changes(crawl_id, property_id, change_type, field_name, old_value, new_value, occurred_at) VALUES(?,?,?,?,?,?,?)')
    .run(crawlId, propId, changeType, fieldName, oldVal, newVal, now);
}

export function getPropertiesNeedingContact(db) {
  return db.prepare(`SELECT p.property_id, p.contact_btn_id FROM properties p
    WHERE p.active=1 AND p.owner_phone IS NULL AND p.contact_btn_id IS NOT NULL
    ORDER BY p.property_id`).all();
}

export function getPropertiesNeedingImages(db) {
  return db.prepare(`SELECT p.property_id FROM properties p
    WHERE p.has_gallery=1 AND p.images_fetched_at IS NULL AND p.active=1
    ORDER BY p.property_id`).all();
}

export function updateContact(db, propId, ownerName, ownerPhone, contactRevealedInListing) {
  const now = new Date().toISOString();
  db.prepare('UPDATE properties SET owner_name=?, owner_phone=?, contact_revealed_in_listing=?, contact_fetched_at=?, contact_btn_id=NULL WHERE property_id=?')
    .run(ownerName, ownerPhone, contactRevealedInListing ? 1 : contactRevealedInListing, now, propId);
}

export function updateImages(db, propId, imageUrls) {
  const now = new Date().toISOString();
  db.prepare('UPDATE properties SET image_urls=?, images_fetched_at=? WHERE property_id=?')
    .run(JSON.stringify(imageUrls), now, propId);
}

export function updateCategoryCount(db, categoryKey, count) {
  const now = new Date().toISOString();
  db.prepare('UPDATE categories SET property_count=?, last_crawled_at=? WHERE key=?')
    .run(count, now, categoryKey);
}

export function getStats(db) {
  const total = db.prepare('SELECT COUNT(*) as c FROM properties WHERE active=1').get().c;
  const withContact = db.prepare('SELECT COUNT(*) as c FROM properties WHERE owner_phone IS NOT NULL').get().c;
  const withImages = db.prepare('SELECT COUNT(*) as c FROM properties WHERE image_urls IS NOT NULL').get().c;
  const byCategory = db.prepare('SELECT category_key, COUNT(*) as c FROM property_listings WHERE active=1 GROUP BY category_key').all();
  return { total, withContact, withImages, byCategory };
}

export function exportProperties(db) {
  return db.prepare(`SELECT
    property_id, property_type, date_posted, address, premise_name, area,
    rent_price_raw, availability_raw, condition_raw, property_age,
    description_raw, furniture_raw, sqft_raw, key_info, brokerage, status,
    is_rented_out, has_gallery, note_raw,
    owner_name, owner_phone,
    image_urls,
    is_premium, is_shortlisted,
    first_seen_at, last_seen_at, last_modified_at,
    active, categories
  FROM properties ORDER BY date_posted DESC, property_id`).all();
}
