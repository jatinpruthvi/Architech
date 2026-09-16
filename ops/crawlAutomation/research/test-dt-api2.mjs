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

let navError = null;
try {
  await page.goto('https://ahmedabad.technoproperty.in/ResidentialRent.php', { waitUntil: 'domcontentloaded', timeout: 100000 });
} catch (e) {
  navError = e.message;
  console.log('nav warning (continuing):', e.message.slice(0, 120));
}

// Poll until the table actually has data
let loaded = false;
for (let i = 0; i < 50; i++) {
  await page.waitForTimeout(1500);
  const state = await page.evaluate(() => {
    try {
      const t = $('#tblpropertylisting').DataTable();
      const info = t.page ? t.page.info() : null;
      return { records: info ? info.recordsTotal : -1, rows: t.rows().count() };
    } catch {
      return { records: -2, rows: 0 };
    }
  });
  if (state.records > 0) { console.log(`Loaded after ~${(i + 1) * 1.5}s:`, JSON.stringify(state)); loaded = true; break; }
  console.log(`poll ${i + 1}:`, JSON.stringify(state));
}
if (navError) console.log('nav error was:', navError);
if (!loaded) {
  console.log('FAILED to load data in browser');
  await context.close();
  process.exit(1);
}

// Now read the data
const out = await page.evaluate(() => {
  const t = $('#tblpropertylisting').DataTable();
  const info = t.page.info();
  const rows = t.rows().data().toArray();

  // full first-row object
  const strip = o => {
    const res = {};
    for (const [k, v] of Object.entries(o)) {
      if (typeof v === 'string') res[k] = v.slice(0, 180);
      else if (v === null || v === undefined || typeof v === 'number' || typeof v === 'boolean') res[k] = v;
      else res[k] = JSON.stringify(v).slice(0, 180);
    }
    return res;
  };

  // renderer columns (the table header showed custom columns like Property Type etc.)
  const headerCells = Array.from(document.querySelectorAll('#tblpropertylisting thead th')).map(th => th.textContent.trim());
  const firstRowCells = Array.from(document.querySelectorAll('#tblpropertylisting tbody tr:first-child td')).map(td => td.textContent.replace(/\s+/g, ' ').trim().slice(0, 120));
  const actionHtml0 = document.querySelector('#tblpropertylisting tbody tr:first-child td:first-child')?.innerHTML.slice(0, 400);

  // any links in action column of first few rows
  const links = Array.from(document.querySelectorAll('#tblpropertylisting tbody tr'))
    .slice(0, 8)
    .map(tr => {
      const a = tr.querySelector('a');
      return { href: a?.href, text: a?.textContent.trim().slice(0, 40) };
    });

  return {
    recordsTotal: info.recordsTotal,
    recordsDisplay: info.recordsDisplay,
    pages: info.pages,
    rowsOnPage: t.rows().count(),
    colCount: headerCells.length,
    headers: headerCells,
    firstRowCells,
    actionHtml0,
    links,
    firstRowObject: strip(rows[0]),
  };
});

writeFileSync('tp-dt-state.json', JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
console.log('\n=== saved tp-dt-state.json');

// Also extract the raw internal DataTable array for the full row data of page
const rawAll = await page.evaluate(() => {
  return $('#tblpropertylisting').DataTable().rows().data().toArray();
});
writeFileSync('tp-dt-rows.json', JSON.stringify(rawAll, null, 2));
console.log('saved tp-dt-rows.json  (', rawAll.length, 'rows )');
// quick peek at one object's keys
if (rawAll[0]) {
  const k = Object.keys(rawAll[0]);
  console.log('\nfirst row keys (' + k.length + '):', k.join(', '));
}

await context.close();