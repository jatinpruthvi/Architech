import { Camoufox } from 'camoufox-js';
import { ensureLoggedIn } from './technoproperty/lib/browser.mjs';

const PROFILE_DIR = 'C:\\Users\\Mishay\\.camofox\\profiles\\b30a0e34683cf2594ffa4b9f9b2379d3';
const BASE_URL = 'https://ahmedabad.technoproperty.in';

async function tryFetch(page, url, params) {
  const d = new URLSearchParams(params).toString();
  const r = await page.evaluate(async ({ u, body }) => {
    const res = await fetch(u, {
      method: 'POST', credentials: 'same-origin', cache: 'no-store',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', 'X-Requested-With': 'XMLHttpRequest' },
      body,
    });
    if (!res.ok) return { error: `HTTP ${res.status}` };
    const text = await res.text();
    let raw;
    try { raw = JSON.parse(text.trim()); } catch { return { error: 'parse', text: text.slice(0, 200) }; }
    if (raw._tpx) return await window.__tpCx7.q(raw);
    return raw;
  }, { u: BASE_URL + url, body: d });
  return { recordsTotal: r?.recordsTotal, rows: r?.data?.length, error: r?.error };
}

async function main() {
  const context = await Camoufox({ headless: false, user_data_dir: PROFILE_DIR });
  const page = await context.newPage();
  await ensureLoggedIn(page, BASE_URL);

  // main: initiallisting=1
  console.log('main RR il=1:', JSON.stringify(await tryFetch(page, '/ajaxpropertydatatable.php', {
    draw: 1, start: 0, length: 1000, searchvalue: 'all',
    propertytype: 'c7f77b53-1a4c-4fe7-1c9e-5147f5e13535', countcategory: 'Residential Rent', initiallisting: 1,
    'order[0][column]': 3, 'order[0][dir]': 'desc',
  })));

  // premium: empty searchvalue + premium_filter
  console.log('premium svEmpty+pf:', JSON.stringify(await tryFetch(page, '/ajaxpremiumpropdatatable.php', {
    draw: 1, start: 0, length: 1000, 'order[0][column]': 3, 'order[0][dir]': 'desc',
    searchvalue: '', premium_filter: 'premiumproperty',
  })));
  // premium: searchvalue=all + premium_filter
  console.log('premium svAll+pf:', JSON.stringify(await tryFetch(page, '/ajaxpremiumpropdatatable.php', {
    draw: 1, start: 0, length: 1000, 'order[0][column]': 3, 'order[0][dir]': 'desc',
    searchvalue: 'all', premium_filter: 'premiumproperty',
  })));

  // important: empty searchvalue
  console.log('important svEmpty:', JSON.stringify(await tryFetch(page, '/ajaximppropdatatable.php', {
    draw: 1, start: 0, length: 1000, 'order[0][column]': 3, 'order[0][dir]': 'desc',
    searchvalue: '',
  })));

  await context.close();
}

main().catch(err => { console.error('FATAL:', err.message); process.exit(1); });