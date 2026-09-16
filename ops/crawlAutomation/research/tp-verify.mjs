import { Camoufox } from 'camoufox-js';
import { ensureLoggedIn } from './technoproperty/lib/browser.mjs';

const PROFILE_DIR = 'C:\\Users\\Mishay\\.camofox\\profiles\\b30a0e34683cf2594ffa4b9f9b2379d3';
const BASE_URL = 'https://ahmedabad.technoproperty.in';

async function main() {
  const context = await Camoufox({ headless: false, user_data_dir: PROFILE_DIR });
  const page = await context.newPage();

  const session = await ensureLoggedIn(page, BASE_URL);
  console.log('SESSION:', JSON.stringify(session));

  // 2. Fetch one batch
  const body = new URLSearchParams({
    draw: 1, start: '0', length: '20',
    searchvalue: 'all', propertytype: 'c7f77b53-1a4c-4fe7-1c9e-5147f5e13535',
    countcategory: 'Residential Rent', initiallisting: 0,
    'order[0][column]': 3, 'order[0][dir]': 'desc',
  }).toString();

  const data = await page.evaluate(async ({ url, d }) => {
    const res = await fetch(url, {
      method: 'POST', credentials: 'same-origin', cache: 'no-store',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', 'X-Requested-With': 'XMLHttpRequest' },
      body: d,
    });
    if (!res.ok) return { error: `HTTP ${res.status}` };
    const text = await res.text();
    let raw;
    try { raw = JSON.parse(text ? text.trim() : '{}'); }
    catch { return { error: 'parse failure', rawText: text }; }
    if (raw._tpx) {
      if (!window.__tpCx7) return { error: 'No decrypt function' };
      return await window.__tpCx7.q(raw);
    }
    return raw;
  }, { url: BASE_URL + '/ajaxpropertydatatable.php', d: body });

  if (data?.rawText) {
    const title = (data.rawText.match(/<title>([^<]*)<\/title>/i) || [])[1] || '';
    const hasTbl = data.rawText.includes('tblpropertylisting');
    const hasForm = data.rawText.includes('<form') && data.rawText.includes('password');
    console.log('RAW RESPONSE: title=', JSON.stringify(title), 'hasTable=', hasTbl, 'hasLoginForm=', hasForm, 'len=', data.rawText.length);
    console.log('  sample body:', data.rawText.slice(2000, 3200).replace(/\s+/g, ' '));
  }
  console.log('Batch error?', data?.error, 'rows:', data?.data?.length, 'recordsTotal:', data?.recordsTotal);
  const rows = data?.data || [];
  const sample = rows[0];
  console.log('\n--- Sample row[0] (first 5 cols) ---');
  for (let i = 0; i < Math.min(5, sample.length); i++) {
    console.log(`  [${i}]: ${String(sample[i]).slice(0, 250)}`);
  }

  // 3. Find a gated contact button + a gallery in sample rows
  let btnId = null, galleryPropId = null;
  for (const r of rows) {
    const col4 = String(r[4] || '');
    const m = col4.match(/id="getcntinfo_([A-Za-z0-9+/=]+)"/);
    if (m && !btnId) btnId = m[1];
    const propId = String(r[0] || '').match(/sharepropertylink_([0-9a-f-]{36})/);
    if (propId && String(r[0] || '').includes('js-image-gallery') && !galleryPropId) galleryPropId = propId[1];
  }
  console.log('\nGated btnId found:', btnId ? btnId.slice(0, 30) + '...' : null);
  console.log('Gallery propId found:', galleryPropId);

  // 4. Test ajaxgetinfo with the button id
  if (btnId) {
    const info = await page.evaluate(async ({ url, id }) => {
      const res = await fetch(url, {
        method: 'POST', credentials: 'same-origin', cache: 'no-store',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', 'X-Requested-With': 'XMLHttpRequest' },
        body: `proprow=${id}&ajax=true`,
      });
      const text = await res.text();
      return { status: res.status, text: text.slice(0, 500) };
    }, { url: BASE_URL + '/ajaxgetinfo.php', id: btnId });
    console.log('\n--- ajaxgetinfo response ---');
    console.log('status:', info.status, '\ntext:', info.text);
  }

  // 5. Test ajaxgetimages with gallery property
  if (galleryPropId) {
    const images = await page.evaluate(async ({ url, pid }) => {
      const res = await fetch(url, {
        method: 'POST', credentials: 'same-origin', cache: 'no-store',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', 'X-Requested-With': 'XMLHttpRequest' },
        body: `propertyId=${pid}&ajax=true`,
      });
      const text = await res.text();
      return { status: res.status, text: text.slice(0, 800) };
    }, { url: BASE_URL + '/ajaxgetimages.php', pid: galleryPropId });
    console.log('\n--- ajaxgetimages response ---');
    console.log('status:', images.status, '\ntext:', images.text);
  }

  // 6. Test premium & important endpoints with generic params
  for (const [name, url, extra] of [
    ['premium', '/ajaxpremiumpropdatatable.php', null],
    ['important', '/ajaximppropdatatable.php', null],
  ]) {
    const p2 = new URLSearchParams({
      draw: 1, start: '0', length: '5', searchvalue: 'all', initiallisting: 0,
      'order[0][column]': 3, 'order[0][dir]': 'desc',
    }).toString();
    const d2 = await page.evaluate(async ({ u, d }) => {
      const res = await fetch(u, {
        method: 'POST', credentials: 'same-origin', cache: 'no-store',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', 'X-Requested-With': 'XMLHttpRequest' },
        body: d,
      });
      if (!res.ok) return { error: `HTTP ${res.status}` };
      const raw = await res.json();
      if (raw._tpx) return await window.__tpCx7.q(raw);
      return raw;
    }, { u: BASE_URL + url, d: p2.toString() });
    console.log(`\n${name}: error=${d2?.error}, rows=${d2?.data?.length}, recordsTotal=${d2?.recordsTotal}`);
  }

  await context.close();
}

main().catch(err => { console.error('FATAL:', err.message); process.exit(1); });