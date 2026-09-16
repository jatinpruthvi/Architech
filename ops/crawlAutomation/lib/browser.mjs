import { Camoufox } from 'camoufox-js';
import { existsSync, mkdirSync, readFileSync } from 'fs';
import { homedir } from 'os';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));

// Minimal .env loader (no dotenv dependency): KEY=value lines, # comments.
// Must run before the constants below so .env values apply. Real environment
// variables always win over .env values.
function loadEnvFile() {
  const envPath = resolve(__dir, '..', '.env');
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    if (/^\s*(#|$)/.test(line)) continue;
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
}

loadEnvFile();

// Headless default is platform-aware: Linux/macOS servers have no display, so
// default to headless there; keep headed on Windows (existing dev behavior).
// Override with --headless / --headed flags or CAMOUFOX_HEADLESS=1/0.
const DEFAULT_PROFILE_DIR =
  process.platform === 'win32'
    ? 'C:\\Users\\Mishay\\.camofox\\profiles\\b30a0e34683cf2594ffa4b9f9b2379d3'
    : resolve(homedir(), '.camofox', 'profiles', 'technoproperty');

let PROFILE_DIR = process.env.TECHNO_PROFILE_DIR || DEFAULT_PROFILE_DIR;
// Ignore Windows paths in non-Windows environments (avoids creating literal C:\ directories in Linux)
if (process.platform !== 'win32' && /^[a-zA-Z]:[\\/]/.test(PROFILE_DIR)) {
  PROFILE_DIR = DEFAULT_PROFILE_DIR;
}

const BASE_URL = process.env.TECHNO_BASE_URL || 'https://ahmedabad.technoproperty.in';

export function loadCredentials() {
  const { TECHNO_USERNAME: username, TECHNO_PASSWORD: password } = process.env;
  if (username && password) return { username, password };
  return null;
}

export function isHeadless() {
  const argv = process.argv.slice(2);
  if (argv.includes('--headed')) return false;
  if (argv.includes('--headless')) return true;
  const v = (process.env.CAMOUFOX_HEADLESS ?? '').trim().toLowerCase();
  if (['1', 'true', 'yes'].includes(v)) return true;
  if (['0', 'false', 'no'].includes(v)) return false;
  return process.platform !== 'win32';
}

export function getProfileDir() {
  return PROFILE_DIR;
}

// ---- Camoufox browser-binary detection (mirrors camoufox-js pkgman) ----

export function getBrowserInstallDir() {
  if (process.env.CAMOUFOX_INSTALL_DIR) return resolve(process.env.CAMOUFOX_INSTALL_DIR);
  if (process.platform === 'win32') return resolve(homedir(), 'AppData', 'Local', 'camoufox', 'camoufox', 'Cache');
  if (process.platform === 'darwin') return resolve(homedir(), 'Library', 'Caches', 'camoufox');
  return resolve(homedir(), '.cache', 'camoufox');
}

export function getBrowserExecPath() {
  const dir = getBrowserInstallDir();
  if (process.platform === 'win32') return resolve(dir, 'camoufox.exe');
  if (process.platform === 'darwin') return resolve(dir, 'Camoufox.app', 'Contents', 'MacOS', 'camoufox');
  return resolve(dir, 'camoufox-bin');
}

export function isBrowserInstalled() {
  try {
    return existsSync(getBrowserExecPath());
  } catch {
    return false;
  }
}

export async function launchBrowser() {
  const headless = isHeadless();
  // Fail fast with an actionable message instead of camoufox-js's
  // download-retry loop when the binary was never fetched.
  if (!isBrowserInstalled()) {
    throw new Error(
      `Camoufox browser binary not found at ${getBrowserExecPath()}.\n` +
        `  Install it once with:  npx camoufox-js fetch\n` +
        `  (or point CAMOUFOX_INSTALL_DIR at an existing install)`
    );
  }
  mkdirSync(PROFILE_DIR, { recursive: true });
  console.log(`Launching Camoufox (headless=${headless}, profile=${PROFILE_DIR})`);
  try {
    const context = await Camoufox({
      headless,
      user_data_dir: PROFILE_DIR,
    });
    return { context, baseUrl: BASE_URL };
  } catch (err) {
    const msg = err?.message || String(err);
    if (/libgtk|libasound|libdbus|libX|libnss|error while loading shared libraries/i.test(msg)) {
      throw new Error(
        `Camoufox failed to launch — missing Linux system libraries.\n` +
          `  Install them with:\n` +
          `  sudo apt update && sudo apt install -y libgtk-3-0 libasound2 libdbus-glib-1-2 libxt6 libx11-xcb1 libnss3 libxss1\n` +
          `  Original error: ${msg.split('\n')[0]}`
      );
    }
    throw err;
  }
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
