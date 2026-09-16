import { Camoufox } from 'camoufox-js';

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

const consoleLogs = [];
page.on('console', msg => {
  if (['error', 'warning'].includes(msg.type())) {
    const t = msg.text();
    if (!t.includes('newrelic') && !t.includes('NREUM')) consoleLogs.push(`[${msg.type()}] ${t.slice(0, 300)}`);
  }
});

await page.goto('https://ahmedabad.technoproperty.in/ResidentialRent.php', { waitUntil: 'domcontentloaded', timeout: 90000 });
// wait for data
for (let i = 0; i < 20; i++) {
  await page.waitForTimeout(1500);
  const rows = await page.evaluate(() => document.querySelectorAll('#tblpropertylisting tbody tr').length);
  if (rows > 0) break;
}

const info = await page.evaluate(() => {
  const out = {};
  const table = $('#tblpropertylisting').DataTable();
  out.apiExists = true;
  out.pageLength = table.page.len();
  out.totalRecords = table.rows().count ? table.rows().count() : null;
  out.ajaxDataLen = table.ajax ? table.ajax.json() ? JSON.stringify(table.ajax.json()).slice(0, 100) : 'noJsonYet' : 'noAjax';
  out.recordsTotal = table.page.info ? table.page.info().recordsTotal : null;
  out.recordsDisplay = table.page.info ? table.page.info().recordsDisplay : null;
  out.pages = table.page ? table.page.info().pages : null;

  // first row's DataTables full data object
  const d0 = table.row(0).data();
  out.row0Object = (typeof d0 === 'object') ? Object.fromEntries(Object.entries(d0).map(([k, v]) => [k, String(v).slice(0, 120)])) : String(d0).slice(0, 200);

  // Action column sample
  const actionCells = Array.from(document.querySelectorAll('#tblpropertylisting tbody tr td:first-child')).slice(0, 5);
  out.actionSamples = actionCells.map(c => c.innerHTML.replace(/\s+/g, ' ').trim().slice(0, 250));

  // any detail links
  const links = Array.from(document.querySelectorAll('#tblpropertylisting tbody a')).slice(0, 10).map(a => ({ href: a.href, text: a.textContent.trim().slice(0, 30) }));
  out.detailLinks = links.length ? links : 'no <a> in tbody';

  // total property count on page
  out.pageTitle = document.title;
  out.propertyCountText = (document.querySelector('.property-count, .total-count, h1 small') || {}).textContent || null;
  return out;
});

console.log('=== DataTables API state ===');
console.log(JSON.stringify(info, null, 2));

console.log('\n=== console errors/warnings ===');
console.log(consoleLogs.join('\n') || '(none)');

// Screenshot for the record
await page.screenshot({ path: 'tp-screenshot.png', fullPage: false });
console.log('\nscreenshot saved');

await context.close();