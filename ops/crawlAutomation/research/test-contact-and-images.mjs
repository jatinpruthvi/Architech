import { Camoufox } from 'camoufox-js';
import { writeFileSync } from 'node:fs';

const PROFILE_DIR = 'C:\\Users\\Mishay\\.camofox\\profiles\\b30a0e34683cf2594ffa4b9f9b2379d3';
const COOKIES = [
  { name: 'PHPSESSID', value: 'b93ndd1hh0206ve18a9ljlivgt', domain: 'ahmedabad.technoproperty.in', path: '/', secure: true, httpOnly: true },
  { name: 'screenWidth', value: '1098', domain: 'ahmedabad.technoproperty.in', path: '/', secure: true },
  { name: '_ga', value: 'GA1.1.986846689.1789451856', domain: '.technoproperty.in', path: '/', secure: true },
  { name: 'cf_clearance', value: 'EadqJbhvxxlLxr81LDmbcWK6gJMrdDwR5Rlnvj6x3v8-1789461733-1.2.1.1-0gSlTxx2Tyuqf5wvRuuNd.QFMQBcKVwy17amGom2Dgbtu9vVyVyAWwA2hvLQLpM0NwkUSMQ2jCUFKH5gJEcRy59SEi3aUG8ZDpPP0cXyDj.yGanI9GL6IauC6ZrvY5YfeAy8Dkg1Kl3xRMTM0AMAbGlXayAZWX.FR7C6VWDJHKd0ABIu6IDFVe1FSP6Tyzr4Uyp7pTnFWunvFm04PpeKBVo_AeprparouzVP9B8kfHg5B11hOZGqwdUILUaUl9Dvdg_0KOJg0zH2OV4SAEhZQhWn5zhv1gAtotcicJCMRXukeL.y.XA3O0.n1ZHV2c7OW4Ga49UxyA69oHvHCFyU.egFiYc0QS13Trf0gvRmUu4', domain: '.technoproperty.in', path: '/', secure: true },
  { name: '_ga_1DEN42JG14', value: 'GS2.1.s1789460051$o3$g1$t1789461854$j60$l0$h0', domain: '.technoproperty.in', path: '/', secure: true },
];

const context = await Camoufox({ headless: false, user_data_dir: PROFILE_DIR });
const page = await context.newPage();
await context.addCookies(COOKIES);

try { await page.goto('https://ahmedabad.technoproperty.in/ResidentialRent.php', { waitUntil: 'domcontentloaded', timeout: 100000 }); } catch {}
for (let i = 0; i < 30; i++) {
  await page.waitForTimeout(1000);
  const ok = await page.evaluate(() => { try { return $('#tblpropertylisting').DataTable().page.info().recordsTotal > 0; } catch { return false; } });
  if (ok) break;
}

const result = await page.evaluate(async () => {
  async function getRow(start, initiallisting) {
    const body = new URLSearchParams({
      draw: 1, start: String(start), length: '1', searchvalue: 'all',
      propertytype: 'c7f77b53-1a4c-4fe7-1c9e-5147f5e13535',
      countcategory: 'Residential Rent', initiallisting: String(initiallisting),
      'order[0][column]': 3, 'order[0][dir]': 'desc',
    });
    const res = await fetch('ajaxpropertydatatable.php', {
      method: 'POST', credentials: 'same-origin', cache: 'no-store',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', 'X-Requested-With': 'XMLHttpRequest' },
      body: body.toString(),
    });
    const raw = await res.json();
    const dec = window.__tpCx7 ? await window.__tpCx7.q(raw) : raw;
    return dec.data[0];
  }

  const r0a = await getRow(0, 1);
  const r0b = await getRow(0, 0);

  // check a multiple-contact sample across more rows using initiallisting=0
  const sample = [];
  const body = new URLSearchParams({
    draw: 1, start: '0', length: '10', searchvalue: 'all',
    propertytype: 'c7f77b53-1a4c-4fe7-1c9e-5147f5e13535',
    countcategory: 'Residential Rent', initiallisting: '0',
    'order[0][column]': 3, 'order[0][dir]': 'desc',
  });
  const res = await fetch('ajaxpropertydatatable.php', {
    method: 'POST', credentials: 'same-origin', cache: 'no-store',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', 'X-Requested-With': 'XMLHttpRequest' },
    body: body.toString(),
  });
  const raw = await res.json();
  const dec = window.__tpCx7 ? await window.__tpCx7.q(raw) : raw;
  for (const r of dec.data) {
    sample.push({ propid: (r[18] || '').match(/value=['"]?([0-9a-f-]{36})/)?.[1], contact: r[4] });
  }

  return {
    initiallisting1_contact: r0a[4]?.slice(0, 200),
    initiallisting0_contact: r0b[4]?.slice(0, 200),
    sample,
  };
});

console.log(JSON.stringify(result, null, 2));
writeFileSync('tp-contact-compare.json', JSON.stringify(result, null, 2));

// now test images endpoint for the gallery property we saw
const img = await page.evaluate(async () => {
  const body = new URLSearchParams({ propertyId: 'd266b985-5c65-d51b-ebc9-6a9fa63fac1f', ajax: 'true' });
  const res = await fetch('ajaxgetimages.php', {
    method: 'POST', credentials: 'same-origin', cache: 'no-store',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', 'X-Requested-With': 'XMLHttpRequest' },
    body: body.toString(),
  });
  const text = await res.text();
  return { status: res.status, size: text.length, body: text.slice(0, 2000) };
});
console.log('\n=== images response ===');
console.log(img);
writeFileSync('tp-ajaxgetimages.json', JSON.stringify(img, null, 2));

await context.close();