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

const reqs = [];
page.on('request', req => {
  if (/\.php/.test(req.url())) reqs.push({ m: req.method(), url: req.url().split('?')[0].split('/').pop() });
});

// Plot & Land Rent
try { await page.goto('https://ahmedabad.technoproperty.in/brokersproperty.php?proptype=PlotAndLandRent', { waitUntil: 'domcontentloaded', timeout: 100000 }); } catch {}
await page.waitForTimeout(6000);

const state = await page.evaluate(() => {
  const out = { url: location.href, title: document.title };
  const tables = document.querySelectorAll('table');
  out.tables = tables.length;
  for (const t of Array.from(tables)) {
    out.rows = document.querySelectorAll('table tbody tr').length;
    out.cards = document.querySelectorAll('.bk-card').length;
    if (t.dataset.proptype) out.proptype = t.dataset.proptype;
    if (t.dataset.brokerMode) out.brokerMode = t.dataset.brokerMode;
    if (t.dataset.loginUrl) out.loginUrl = t.dataset.loginUrl;
  }
  const lock = document.querySelector('.broker-table-end-lock, [data-broker-mode]');
  out.lockText = lock ? lock.textContent.replace(/\s+/g, ' ').trim().slice(0, 120) : null;
  // pagination?
  out.pagination = document.querySelector('.dataTables_paginate, .pagination, .broker-pagination')?.textContent.replace(/\s+/g,' ').trim().slice(0,200) || null;
  // DataTable present?
  out.isDt = window.$ && $.fn && $.fn.dataTable ? $.fn.dataTable.isDataTable('table') : false;
  // sample card
  const c = document.querySelector('.bk-card');
  out.cardText = c ? c.textContent.replace(/\s+/g, ' ').trim().slice(0, 400) : null;
  // Any element with data-propid or propid-ish
  out.propRefs = document.querySelectorAll('[data-propid], [id^=rentedout_]').length;
  return out;
});
console.log('=== PlotAndLandRent state ===');
console.log(JSON.stringify(state, null, 2));
console.log('\n=== php requests ===');
console.log(JSON.stringify(reqs, null, 2));
writeFileSync('tp-plotland-state.json', JSON.stringify({ state, reqs }, null, 2));

// Also check brokersproperty.php with the main proptype=ResidentialRent to compare
reqs.length = 0;
try { await page.goto('https://ahmedabad.technoproperty.in/brokersproperty.php?proptype=ResidentialRent', { waitUntil: 'domcontentloaded', timeout: 100000 }); } catch {}
await page.waitForTimeout(6000);
const state2 = await page.evaluate(() => {
  const out = { url: location.href, title: document.title };
  out.tables = document.querySelectorAll('table').length;
  out.rows = document.querySelectorAll('table tbody tr').length;
  out.cards = document.querySelectorAll('.bk-card').length;
  out.isDt = window.$ && $.fn && $.fn.dataTable ? $.fn.dataTable.isDataTable('table') : false;
  out.mode = document.querySelector('[data-broker-mode]')?.dataset.brokerMode || null;
  const t = $('#tblpropertylisting');
  if (t.length) { try { out.dtInfo = t.DataTable().page.info(); } catch {} }
  return out;
});
console.log('\n=== brokersproperty.php?proptype=ResidentialRent state ===');
console.log(JSON.stringify(state2, null, 2));
console.log('\n=== phps ===');
console.log(JSON.stringify(reqs, null, 2));
writeFileSync('tp-brokerspass-state.json', JSON.stringify({ state2, reqs }, null, 2));

await context.close();