import { Camoufox } from 'camoufox-js';
import { writeFileSync } from 'node:fs';

const PROFILE_DIR = 'C:\\Users\\Mishay\\.camofox\\profiles\\b30a0e34683cf2594ffa4b9f9b2379d3';

// Set the session cookie for technoproperty.in in this profile via context
const context = await Camoufox({ headless: false, user_data_dir: PROFILE_DIR });
const page = await context.newPage();

const COOKIES = [
  { name: 'PHPSESSID', value: 'b93ndd1hh0206ve18a9ljlivgt', domain: 'ahmedabad.technoproperty.in', path: '/', secure: true, httpOnly: true },
  { name: 'screenWidth', value: '1098', domain: 'ahmedabad.technoproperty.in', path: '/', secure: true },
  { name: '_ga', value: 'GA1.1.986846689.1789451856', domain: '.technoproperty.in', path: '/', secure: true },
  { name: 'cf_clearance', value: 'EadqJbhvxxlLxr81LDmbcWK6gJMrdDwR5Rlnvj6x3v8-1789461733-1.2.1.1-0gSlTxx2Tyuqf5wvRuuNd.QFMQBcKVwy17amGom2Dgbtu9vVyVyAWwA2hvLQLpM0NwkUSMQ2jCUFKH5gJEcRy59SEi3aUG8ZDpPP0cXyDj.yGanI9GL6IauC6ZrvY5YfeAy8Dkg1Kl3xRMTM0AMAbGlXayAZWX.FR7C6VWDJHKd0ABIu6IDFVe1FSP6Tyzr4Uyp7pTnFWunvFm04PpeKBVo_AeprparouzVP9B8kfHg5B11hOZGqwdUILUaUl9Dvdg_0KOJg0zH2OV4SAEhZQhWn5zhv1gAtotcicJCMRXukeL.y.XA3O0.n1ZHV2c7OW4Ga49UxyA69oHvHCFyU.egFiYc0QS13Trf0gvRmUu4', domain: '.technoproperty.in', path: '/', secure: true },
  { name: '_ga_1DEN42JG14', value: 'GS2.1.s1789460051$o3$g1$t1789461854$j60$l0$h0', domain: '.technoproperty.in', path: '/', secure: true },
];

await context.addCookies(COOKIES);
console.log('Cookies added');

// Track the AJAX call
let ajaxResponse = null;
page.on('response', async res => {
  if (res.url().includes('ajaxpropertydatatable.php')) {
    try {
      ajaxResponse = { status: res.status(), body: await res.text() };
      console.log('AJAX response captured:', res.status(), ajaxResponse.body.length);
    } catch {}
  }
});

// Load the listing page
console.log('\nLoading ResidentialRent.php...');
await page.goto('https://ahmedabad.technoproperty.in/ResidentialRent.php', { waitUntil: 'networkidle', timeout: 90000 });
await page.waitForTimeout(6000);

// Check what the page shows
const info = await page.evaluate(() => {
  const rows = document.querySelectorAll('#tblpropertylisting tbody tr');
  const dtInfo = document.querySelector('.dataTables_info');
  const dtPage = document.querySelector('.dataTables_paginate');
  return {
    url: window.location.href,
    rowCount: rows.length,
    dtInfo: dtInfo?.textContent?.trim() || null,
    paginationPresent: !!dtPage,
    pageText: dtPage?.textContent?.trim().slice(0, 200) || null,
    preview: rows.length ? Array.from(rows).slice(0, 3).map(r => r.textContent.replace(/\s+/g, ' ').trim().slice(0, 300)) : [],
  };
});
console.log('\n=== Page state ===');
console.log(JSON.stringify(info, null, 2));

if (ajaxResponse) {
  writeFileSync('tp-browser-ajax.json', ajaxResponse.body);
  console.log('\nAJAX response saved.');
}

await context.close();