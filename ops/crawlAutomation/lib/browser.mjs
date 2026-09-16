import { Camoufox } from 'camoufox-js';
import { existsSync, readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const PROFILE_DIR =
  process.env.TECHNO_PROFILE_DIR ||
  'C:\\Users\\Mishay\\.camofox\\profiles\\b30a0e34683cf2594ffa4b9f9b2379d3';
const BASE_URL = process.env.TECHNO_BASE_URL || 'https://ahmedabad.technoproperty.in';

export function loadCredentials() {
  const fromEnv = {
    username: process.env.TECHNO_USERNAME,
    password: process.env.TECHNO_PASSWORD,
  };
  if (fromEnv.username && fromEnv.password) return fromEnv;

  const envPath = resolve(__dir, '..', '.env');
  if (existsSync(envPath)) {
    const creds = {};
    for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*TECHNO_USERNAME\s*=\s*(.+?)\s*$/);
      if (m) creds.username = m[1];
      const m2 = line.match(/^\s*TECHNO_PASSWORD\s*=\s*(.+?)\s*$/);
      if (m2) creds.password = m2[1];
    }
    if (creds.username && creds.password) return creds;
  }
  return null;
}

export async function launchBrowser() {
  const context = await Camoufox({
    headless: false,
    user_data_dir: PROFILE_DIR,
  });
  return { context, baseUrl: BASE_URL };
}

export async function verifySessionApi(page, baseUrl = BASE_URL) {
  // True authenticated probe. brokerpropertycount.php returns the broker panel
  // HTML when the session is valid, or the login page redirect when it isn't
  // (dashboard pages still render 200 even with a dead session cookie).
  try {
    const r = await page.evaluate(async ({ baseUrl }) => {
      const res = await fetch(baseUrl + '/brokerpropertycount.php', {
        cache: 'no-store',
        credentials: 'same-origin',
      });
      const text = await res.text();
      return { status: res.status, text };
    }, { baseUrl });
    return !!(r && r.status === 200 && r.text.startsWith('<section'));
  } catch {
    return false;
  }
}

export async function ensureLoggedIn(page, baseUrl = BASE_URL) {
  // Returns { ok: true, method } if a valid session exists (or was created).
  const checkLoggedIn = async () => {
    try {
      await page.goto(`${baseUrl}/dashboard.php`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(2500);
      const url = page.url();
      if (url.includes('login.php')) return false;
      return await verifySessionApi(page, baseUrl);
    } catch {
      return false;
    }
  };

  if (await checkLoggedIn()) return { ok: true, method: 'existing' };

  const creds = loadCredentials();
  if (!creds) {
    return {
      ok: false,
      method: 'none',
      message: 'No session and no credentials found. Set TECHNO_USERNAME/TECHNO_PASSWORD env vars or create crawlAutomation/.env (TECHNO_USERNAME=..., TECHNO_PASSWORD=...).',
    };
  }

  await page.goto(`${baseUrl}/login.php`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(2000);
  try {
    await page.fill('#login-username', creds.username);
    await page.fill('#login-password', creds.password);
    await page.click('#loginButton');
  } catch {
    // fill/click failed; fall through to form.submit() path below
  }
  await page.waitForTimeout(4000);

  if (await checkLoggedIn()) return { ok: true, method: 'auto-login' };

  // maybe the submit needs the button form submit; try direct form submit as fallback
  try {
    await page.goto(`${baseUrl}/login.php`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(2000);
    await page.fill('#login-username', creds.username);
    await page.fill('#login-password', creds.password);
    await page.evaluate(() => {
      const f = document.querySelector('form[action*="login.php"]');
      if (f) f.submit();
      return !!f;
    });
    await page.waitForTimeout(4000);
  } catch { /* ignore */ }

  if (await checkLoggedIn()) return { ok: true, method: 'auto-login' };

  return {
    ok: false,
    method: 'auto-login',
    message: 'Auto-login failed. Check credentials in crawlAutomation/.env, or the site may require manual login via the Camoufox profile.',
  };
}

export async function navigateAndWaitForTable(page, url, maxWaitMs = 90000) {
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: maxWaitMs });
  } catch {
    // navigation timeout - proceed anyway, table may still load
  }
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    await page.waitForTimeout(1200);
    const count = await page.evaluate(() => {
      try { return $('#tblpropertylisting').DataTable().page.info().recordsTotal; }
      catch { return 0; }
    });
    if (count > 0) return count;
  }
  return 0;
}
