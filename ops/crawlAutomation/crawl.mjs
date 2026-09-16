import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { launchBrowser, ensureLoggedIn, navigateAndWaitForTable, isHeadless, getProfileDir, getBrowserExecPath, isBrowserInstalled, loadCredentials } from './lib/browser.mjs';
import { CATEGORIES } from './lib/categories.mjs';
import { parseListingRows } from './lib/parse.mjs';
export { CATEGORIES } from './lib/categories.mjs';
import {
  openDb, beginCrawl, finishCrawl, failCrawl, upsertProperty,
  markRemovedFromCategory, reconcileActiveProperties, logChange, getPropertiesNeedingContact,
  getPropertiesNeedingImages, updateContact, updateImages,
  updateCategoryCount, getStats, exportProperties,
} from './lib/db.mjs';

function seedCategories(db) {
  const stmt = db.prepare('INSERT OR IGNORE INTO categories(key, display_name, url, ajax_url, propertytype_guid, endpoint_type) VALUES(?,?,?,?,?,?)');
  for (const c of CATEGORIES) {
    stmt.run(c.key, c.displayName, c.url, c.ajaxUrl, c.guid, c.type);
  }
}

const __dir = dirname(fileURLToPath(import.meta.url));
const EXPORTS_DIR = resolve(__dir, 'exports');
mkdirSync(EXPORTS_DIR, { recursive: true });

const BATCH_SIZE = 1000;

// ==================== BROWSER DATA ACCESS ====================

// The site serves the login page (HTTP 200) with a dead session cookie, so
// each fetch helper detects it in-page and returns { error: 'SESSION_EXPIRED' }.

async function reAuth(page, baseUrl) {
  const session = await ensureLoggedIn(page, baseUrl);
  if (session.ok) console.log('  (session refreshed)');
  else console.log('  (session refresh FAILED)');
  await page.waitForTimeout(1500);
  return session.ok;
}

async function fetchListingBatch(page, baseUrl, ajaxUrl, category, start, batchSize) {
  let body;
  if (category.type === 'main') {
    const params = new URLSearchParams({
      draw: 1, start: String(start), length: String(batchSize),
      searchvalue: 'all', propertytype: category.guid,
      countcategory: category.countCategory, initiallisting: 1,
      'order[0][column]': 3, 'order[0][dir]': 'desc',
    });
    body = params.toString();
  } else {
    // For premium/important: empty searchvalue; premium needs its filter param
    const params = new URLSearchParams({
      draw: 1, start: String(start), length: String(batchSize),
      'order[0][column]': 3, 'order[0][dir]': 'desc',
      searchvalue: '',
    });
    if (category.type === 'premium') {
      params.set('premium_filter', 'premiumproperty');
    }
    body = params.toString();
  }

  const result = await page.evaluate(async ({ url, data }) => {
    const res = await fetch(url, {
      method: 'POST', credentials: 'same-origin', cache: 'no-store',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: data,
    });
    const text = await res.text();
    if (!text || /^\s*(<!DOCTYPE HTML|<!doctype html|<html)/i.test(text)) {
      return { error: 'SESSION_EXPIRED' };
    }
    let raw;
    try { raw = JSON.parse(text); } catch { return { error: 'BAD_JSON', text: text.slice(0, 80) }; }
    if (raw._tpx) {
      if (!window.__tpCx7) return { error: 'No decrypt function' };
      const dec = await window.__tpCx7.q(raw);
      return dec;
    }
    return raw;
  }, { url: baseUrl + ajaxUrl, data: body });

  return result;
}

async function fetchContact(page, baseUrl, contactBtnId) {
  const result = await page.evaluate(async ({ url, btnId }) => {
    const body = `proprow=${btnId}&ajax=true`;
    const res = await fetch(url, {
      method: 'POST', credentials: 'same-origin', cache: 'no-store',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body,
    });
    const text = await res.text();
    if (!text || /^\s*(<!DOCTYPE HTML|<!doctype html|<html)/i.test(text)) {
      return { error: 'SESSION_EXPIRED' };
    }
    try { return JSON.parse(text); } catch { return { error: 'BAD_JSON', text: text.slice(0, 80) }; }
  }, { url: baseUrl + '/ajaxgetinfo.php', btnId: contactBtnId });
  return result;
}

async function fetchImages(page, baseUrl, propertyId) {
  const result = await page.evaluate(async ({ url, propId }) => {
    const body = `propertyId=${propId}&ajax=true`;
    const res = await fetch(url, {
      method: 'POST', credentials: 'same-origin', cache: 'no-store',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body,
    });
    const text = await res.text();
    if (!text || /^\s*(<!DOCTYPE HTML|<!doctype html|<html)/i.test(text)) {
      return { error: 'SESSION_EXPIRED' };
    }
    // Extract image URLs from the gallery JSON embedded in the HTML
    const match = text.match(/<script[^>]*class="js-gallery-images"[^>]*>\s*(\[[\s\S]*?\])\s*<\/script>/);
    if (match) {
      try {
        const urls = JSON.parse(match[1]);
        return { urls };
      } catch {
        return { urls: [], parseError: true };
      }
    }
    return { urls: [], noGallery: true };
  }, { url: baseUrl + '/ajaxgetimages.php', propId: propertyId });
  return result;
}

// ==================== CRAWL LOGIC ====================

async function crawlCategory(page, baseUrl, category, db, crawlId, opts = {}) {
  const { isPremium = false, isShortlisted = false } = opts;
  const fullUrl = baseUrl + category.url;
  console.log(`\n>>> Crawling ${category.displayName} (${fullUrl})`);

  const totalRecords = await navigateAndWaitForTable(page, fullUrl);
  if (totalRecords === 0) {
    console.log(`  No records found for ${category.displayName}`);
    return { total: 0, new: 0, updated: 0, removed: 0, errors: 0 };
  }
  console.log(`  Records: ${totalRecords}`);

  let processed = 0;
  let newCount = 0, updatedCount = 0, removedCount = 0, errorCount = 0;
  const currentPropIds = [];
  const context = { isPremium, isShortlisted };

  for (let start = 0; start < totalRecords; start += BATCH_SIZE) {
    const batchNum = Math.floor(start / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(totalRecords / BATCH_SIZE);
    process.stdout.write(`  Batch ${batchNum}/${totalBatches} (${start}-${Math.min(start + BATCH_SIZE - 1, totalRecords - 1)})...`);

    let data = await fetchListingBatch(page, baseUrl, category.ajaxUrl, category, start, BATCH_SIZE);

    if (data?.error === 'SESSION_EXPIRED') {
      console.log(` SESSION_EXPIRED - refreshing...`);
      if (await reAuth(page, baseUrl)) {
        data = await fetchListingBatch(page, baseUrl, category.ajaxUrl, category, start, BATCH_SIZE);
      }
    }

    if (data?.error) {
      console.log(` ERROR: ${data.error}`);
      errorCount++;
      // retry once after a short delay
      await page.waitForTimeout(3000);
      const retry = await fetchListingBatch(page, baseUrl, category.ajaxUrl, category, start, BATCH_SIZE);
      if (retry?.error) {
        console.log(`  Retry failed: ${retry.error}`);
        continue;
      }
      const rows = retry.data || [];
      const parsed = parseListingRows(rows, category.key, context);
      const batchResult = handleBatchResult(parsed, category, db, crawlId, currentPropIds);
      newCount += batchResult.newCount;
      updatedCount += batchResult.updatedCount;
      errorCount += batchResult.errorCount;
      processed += parsed.length;
      console.log(` OK (retry) [${parsed.length} rows]`);
      continue;
    }

    const rows = data?.data || [];
    const parsed = parseListingRows(rows, category.key, context);
    const batchResult = handleBatchResult(parsed, category, db, crawlId, currentPropIds);
    newCount += batchResult.newCount;
    updatedCount += batchResult.updatedCount;
    errorCount += batchResult.errorCount;
    processed += parsed.length;

    console.log(` OK [${parsed.length} rows, ${batchResult.newCount} new, ${batchResult.updatedCount} updated]`);
  }

  // Mark removed properties
  removedCount = markRemovedFromCategory(db, crawlId, category.key, currentPropIds);
  if (removedCount > 0) console.log(`  Removed: ${removedCount} properties no longer in ${category.displayName}`);

  updateCategoryCount(db, category.key, totalRecords);

  return { total: totalRecords, new: newCount, updated: updatedCount, removed: removedCount, errors: errorCount };
}

function handleBatchResult(parsed, category, db, crawlId, currentPropIds) {
  let newCount = 0, updatedCount = 0, errorCount = 0;
  for (const prop of parsed) {
    try {
      const before = db.prepare('SELECT row_hash FROM properties WHERE property_id=?').get(prop.property_id);
      const changeType = upsertProperty(db, prop, crawlId);
      currentPropIds.push(prop.property_id);

      if (changeType === 'new') {
        newCount++;
        logChange(db, crawlId, prop.property_id, 'new', null, null, prop.address);
      } else if (changeType === 'updated') {
        updatedCount++;
        const old = before ? before.row_hash : null;
        logChange(db, crawlId, prop.property_id, 'updated', 'row_hash', old, prop.row_hash);
      }
    } catch (err) {
      errorCount++;
      console.error(`    Error processing ${prop.property_id}: ${err.message}`);
    }
  }
  return { newCount, updatedCount, errorCount };
}

async function fetchContactsForProperties(page, baseUrl, db) {
  const properties = getPropertiesNeedingContact(db);
  if (properties.length === 0) {
    console.log('\n>>> All properties already have contact info');
    return 0;
  }
  console.log(`\n>>> Fetching contacts for ${properties.length} gated properties...`);

  let fetched = 0, errors = 0;
  let sessionOk = true;
  for (let i = 0; i < properties.length; i++) {
    const p = properties[i];
    process.stdout.write(`  [${i + 1}/${properties.length}] ${p.property_id.slice(0, 8)}...`);

    let result;
    let gaveUp = false;
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        result = await fetchContact(page, baseUrl, p.contact_btn_id);
      } catch (err) {
        result = { error: err.message };
      }

      if (result?.error === 'SESSION_EXPIRED') {
        if (attempt === 0) {
          process.stdout.write(' SESSION_EXPIRED...');
          sessionOk = await reAuth(page, baseUrl);
          if (!sessionOk) { console.log(' aborting'); gaveUp = true; break; }
        }
        continue;
      }
      // Rate-limited ("Try Again" response) - back off and retry
      if (result?.status === 'fail') {
        const delay = 1000 * Math.pow(3, attempt);
        process.stdout.write(` fail#${attempt + 1}...`);
        await page.waitForTimeout(delay);
        continue;
      }
      break;
    }

    if (gaveUp) break;
    if (!sessionOk) break;

    if (result?.status === 'success' && result.html) {
      const m = result.html.match(/^(.+?)<br\s*\/?>\s*(\d{10})/);
      if (m) {
        updateContact(db, p.property_id, m[1].trim(), m[2], 0);
        console.log(` ${m[1].trim()} | ${m[2]}`);
        fetched++;
      } else {
        console.log(` contact parsed: "${result.html.slice(0, 60)}"`);
        updateContact(db, p.property_id, result.html, null, 0);
        fetched++;
      }
    } else {
      console.log(` FAIL (${result?.status || result?.error || 'no status'})`);
      errors++;
    }

    if (i % 5 === 4) await page.waitForTimeout(400);
  }

  return fetched;
}

async function fetchImagesForProperties(page, baseUrl, db) {
  const properties = getPropertiesNeedingImages(db);
  if (properties.length === 0) {
    console.log('\n>>> All properties with galleries already have images');
    return 0;
  }
  console.log(`\n>>> Fetching images for ${properties.length} properties...`);

  let fetched = 0, errors = 0;
  let sessionOk = true;
  for (let i = 0; i < properties.length; i++) {
    const { property_id } = properties[i];
    process.stdout.write(`  [${i + 1}/${properties.length}] ${property_id.slice(0, 8)}...`);

    let result;
    try {
      result = await fetchImages(page, baseUrl, property_id);
    } catch (err) {
      result = { error: err.message };
    }

    if (result?.error === 'SESSION_EXPIRED') {
      process.stdout.write(' SESSION_EXPIRED...');
      sessionOk = await reAuth(page, baseUrl);
      if (sessionOk) {
        try { result = await fetchImages(page, baseUrl, property_id); }
        catch (err) { result = { error: err.message }; }
      }
      if (!sessionOk || result?.error) {
        console.log(` ERROR: ${result?.error || 'session lost'}`);
        errors++;
        break;
      }
    }

    if (result?.error) {
      console.log(` ERROR: ${result.error}`);
      errors++;
    } else if (result?.urls?.length > 0) {
      updateImages(db, property_id, result.urls);
      console.log(` ${result.urls.length} images`);
      fetched++;
    } else {
      updateImages(db, property_id, []);
      console.log(' no images');
      fetched++;
    }

    if (i % 10 === 9) await page.waitForTimeout(500);
  }

  return fetched;
}

// ==================== COMMANDS ====================

const CLI_ARGS = process.argv.slice(2);
const hasFlag = (name) => CLI_ARGS.includes(name);
const getFlagValue = (name) => {
  const i = CLI_ARGS.indexOf(name);
  return i >= 0 ? CLI_ARGS[i + 1] : null;
};

function selectedCategories() {
  const catArg = getFlagValue('--category') || getFlagValue('-c');
  if (!catArg) return CATEGORIES;
  const wanted = catArg.split(',').map(s => s.trim().toLowerCase());
  const found = CATEGORIES.filter(c => wanted.includes(c.key.toLowerCase()) || wanted.includes(c.displayName.toLowerCase()));
  if (found.length === 0) {
    console.error(`Unknown category: ${catArg}. Available: ${CATEGORIES.map(c => c.key).join(', ')}`);
    process.exit(1);
  }
  return found;
}

async function cmdFull() {
  console.log('=== FULL CRAWL ===');
  const cats = selectedCategories();
  let context, baseUrl;
  try {
    ({ context, baseUrl } = await launchBrowser());
  } catch (err) {
    console.error('ERROR: Could not launch browser.');
    console.error(`  ${String(err.message || err).split('\n').join('\n  ')}`);
    process.exit(1);
  }
  const page = await context.newPage();
  const session = await ensureLoggedIn(page, baseUrl);
  if (!session.ok) {
    console.error('ERROR: No valid session.');
    console.error(`  ${session.message}`);
    await context.close();
    process.exit(1);
  }
  console.log('Session valid:', session.method);

  const db = openDb();
  seedCategories(db);
  const crawlId = beginCrawl(db, 'full');
  const stats = { total: 0, new: 0, updated: 0, removed: 0, contacts: 0, images: 0, errors: 0 };

  try {
    for (const cat of cats) {
      const result = await crawlCategory(page, baseUrl, cat, db, crawlId, {
        isPremium: cat.key === 'Premium',
        isShortlisted: cat.key === 'Important',
      });
      stats.total += result.total;
      stats.new += result.new;
      stats.updated += result.updated;
      stats.removed += result.removed;
      stats.errors += result.errors;
    }

    reconcileActiveProperties(db);

    if (!hasFlag('--no-meta')) {
      // Fetch contacts
      stats.contacts = await fetchContactsForProperties(page, baseUrl, db);

      // Fetch images
      stats.images = await fetchImagesForProperties(page, baseUrl, db);
    }

    await page.close();
  } catch (err) {
    console.error('Fatal error:', err.message);
    stats.errors++;
  }

  finishCrawl(db, crawlId, stats);
  printStats(stats);
  exportCsv(db);
  db.close();
  await context.close();
}

async function cmdDelta() {
  console.log('=== DELTA CRAWL ===');
  const cats = selectedCategories();
  let context, baseUrl;
  try {
    ({ context, baseUrl } = await launchBrowser());
  } catch (err) {
    console.error('ERROR: Could not launch browser.');
    console.error(`  ${String(err.message || err).split('\n').join('\n  ')}`);
    process.exit(1);
  }
  const page = await context.newPage();
  const session = await ensureLoggedIn(page, baseUrl);
  if (!session.ok) {
    console.error('ERROR: No valid session.');
    console.error(`  ${session.message}`);
    await context.close();
    process.exit(1);
  }
  console.log('Session valid:', session.method);

  const db = openDb();
  seedCategories(db);
  const crawlId = beginCrawl(db, 'delta');
  const stats = { total: 0, new: 0, updated: 0, removed: 0, contacts: 0, images: 0, errors: 0 };

  try {
    for (const cat of cats) {
      const result = await crawlCategory(page, baseUrl, cat, db, crawlId, {
        isPremium: cat.key === 'Premium',
        isShortlisted: cat.key === 'Important',
      });
      stats.total += result.total;
      stats.new += result.new;
      stats.updated += result.updated;
      stats.removed += result.removed;
      stats.errors += result.errors;
    }

    reconcileActiveProperties(db);

    // Fetch contacts/images only for new/changed
    const needContact = db.prepare('SELECT COUNT(*) as c FROM properties WHERE contact_fetched_at IS NULL AND active=1').get().c;
    const needImages = db.prepare('SELECT COUNT(*) as c FROM properties WHERE has_gallery=1 AND images_fetched_at IS NULL AND active=1').get().c;

    if (needContact > 0 || needImages > 0) {
      console.log(`\n>>> Backfilling: ${needContact} contacts, ${needImages} image sets needed`);
      if (!hasFlag('--no-meta')) {
        if (needContact > 0) {
          stats.contacts = await fetchContactsForProperties(page, baseUrl, db);
        }
        if (needImages > 0) {
          stats.images = await fetchImagesForProperties(page, baseUrl, db);
        }
      } else {
        console.log('  (skipped - --no-meta)');
      }
    }

    await page.close();
  } catch (err) {
    console.error('Fatal error:', err.message);
    stats.errors++;
  }

  finishCrawl(db, crawlId, stats);
  printStats(stats);
  exportCsv(db);
  db.close();
  await context.close();
}

function cmdExport() {
  const db = openDb();
  exportCsv(db);
  db.close();
}

async function cmdCheck() {
  // Layered environment diagnostic: verifies every prerequisite for a
  // headless crawl without touching the portal (smoke test uses about:blank).
  // Exit 0 = ready to crawl; exit 1 = a FATAL check failed.
  console.log('=== ENVIRONMENT CHECK ===');
  const results = [];
  const check = (name, ok, detail = '', fatal = true) => {
    results.push({ name, ok, fatal });
    console.log(`  [${ok ? 'PASS' : 'FAIL'}]${fatal ? '' : ' (advisory)'} ${name}${detail ? ` — ${detail}` : ''}`);
  };

  const nodeMajor = parseInt(process.versions.node.split('.')[0], 10);
  check(`Node ${process.versions.node} (>=20 required)`, nodeMajor >= 20);

  try {
    await import('better-sqlite3');
    check('better-sqlite3 loads', true);
  } catch (e) { check('better-sqlite3 loads', false, String(e.message || e).split('\n')[0]); }

  try {
    await import('camoufox-js');
    check('camoufox-js loads', true);
  } catch (e) { check('camoufox-js loads', false, String(e.message || e).split('\n')[0]); }

  check(
    `headless resolution (platform=${process.platform}, CAMOUFOX_HEADLESS=${process.env.CAMOUFOX_HEADLESS ?? 'unset'}) => headless=${isHeadless()}`,
    true, '', false
  );

  const execPath = getBrowserExecPath();
  check(
    `Camoufox browser binary (${execPath})`,
    isBrowserInstalled(),
    isBrowserInstalled() ? '' : 'run: npx camoufox-js fetch'
  );

  try {
    mkdirSync(getProfileDir(), { recursive: true });
    check(`profile dir writable (${getProfileDir()})`, true);
  } catch (e) { check('profile dir writable', false, String(e.message || e).split('\n')[0]); }

  const creds = loadCredentials();
  check('portal credentials (.env or env)', !!creds, creds ? '' : 'only needed if the saved session expired', false);

  try {
    const db = openDb();
    db.close();
    check('SQLite DB opens (data/technoproperty.db)', true);
  } catch (e) { check('SQLite DB opens', false, String(e.message || e).split('\n')[0]); }

  if (isBrowserInstalled()) {
    try {
      const { context } = await launchBrowser();
      const page = await context.newPage();
      await page.goto('about:blank');
      const ua = await page.evaluate(() => navigator.userAgent);
      await context.close();
      check('headless launch smoke test (about:blank)', true, ua.slice(0, 70) + '...');
    } catch (e) {
      check('headless launch smoke test', false, String(e.message || e).split('\n')[0]);
    }
  } else {
    check('headless launch smoke test', false, 'skipped — browser not installed');
  }

  const fatalFails = results.filter(r => !r.ok && r.fatal);
  console.log(fatalFails.length === 0 ? '\nREADY: all checks passed.' : `\nNOT READY: ${fatalFails.length} failing check(s). Fix them, then re-run --check.`);
  process.exitCode = fatalFails.length === 0 ? 0 : 1;
}

function cmdStatus() {
  const db = openDb();
  const stats = getStats(db);
  console.log('=== DATABASE STATUS ===');
  console.log(`  Total active properties: ${stats.total}`);
  console.log(`  With contact info: ${stats.withContact}`);
  console.log(`  With images: ${stats.withImages}`);
  console.log('  By category:');
  for (const row of stats.byCategory) {
    console.log(`    ${row.category_key}: ${row.c}`);
  }
  const lastCrawl = db.prepare('SELECT * FROM crawls ORDER BY id DESC LIMIT 1').get();
  if (lastCrawl) {
    console.log(`\n  Last crawl: #${lastCrawl.id} (${lastCrawl.mode}) started ${lastCrawl.started_at}`);
    if (lastCrawl.finished_at) {
      console.log(`    Finished: ${lastCrawl.finished_at} [${lastCrawl.status}]`);
      console.log(`    Total: ${lastCrawl.total_properties} | New: ${lastCrawl.new_properties} | Updated: ${lastCrawl.updated_properties} | Removed: ${lastCrawl.removed_properties}`);
    } else {
      console.log(`    Status: ${lastCrawl.status} (incomplete)`);
    }
  }
  db.close();
}

function exportCsv(db) {
  const props = exportProperties(db);
  if (props.length === 0) {
    console.log('\nNo properties to export');
    return;
  }
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filePath = resolve(EXPORTS_DIR, `properties-${timestamp}.csv`);

  const headers = [
    'property_id', 'property_type', 'date_posted', 'address', 'premise_name', 'area',
    'rent_price_raw', 'availability_raw', 'condition_raw', 'property_age',
    'description_raw', 'furniture_raw', 'sqft_raw', 'key_info', 'brokerage', 'status',
    'is_rented_out', 'has_gallery', 'note_raw',
    'owner_name', 'owner_phone', 'image_urls',
    'is_premium', 'is_shortlisted',
    'first_seen_at', 'last_seen_at', 'last_modified_at',
    'active', 'categories',
  ];

  const escape = (val) => {
    if (val === null || val === undefined) return '';
    const s = String(val);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  };

  const lines = [headers.join(',')];
  for (const p of props) {
    lines.push(headers.map(h => escape(p[h])).join(','));
  }

  writeFileSync(filePath, lines.join('\n'));
  console.log(`\nCSV exported: ${filePath} (${props.length} properties)`);
}

function printStats(stats) {
  console.log('\n=== CRAWL COMPLETE ===');
  console.log(`  Total properties: ${stats.total}`);
  console.log(`  New: ${stats.new}`);
  console.log(`  Updated: ${stats.updated}`);
  console.log(`  Removed: ${stats.removed}`);
  console.log(`  Contacts fetched: ${stats.contacts}`);
  console.log(`  Images fetched: ${stats.images}`);
  console.log(`  Errors: ${stats.errors}`);
}

// ==================== CLI ====================

const cmd = process.argv[2] || '--status';
console.log(`TechnoProperty Crawler - ${new Date().toISOString()}`);
console.log(`Command: ${cmd}`);

switch (cmd) {
  case '--full':
  case 'full':
    await cmdFull();
    break;
  case '--delta':
  case 'delta':
    await cmdDelta();
    break;
  case '--export':
  case 'export':
    cmdExport();
    break;
  case '--check':
  case 'check':
    await cmdCheck();
    break;
  case '--status':
  case 'status':
  default:
    cmdStatus();
    break;
}
