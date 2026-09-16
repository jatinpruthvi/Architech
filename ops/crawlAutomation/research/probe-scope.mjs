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

const categories = [
  ['ResidentialRent', 'https://ahmedabad.technoproperty.in/ResidentialRent.php', 'Residential Rent'],
  ['ResidentialSell', 'https://ahmedabad.technoproperty.in/ResidentialSell.php', 'Residential Sell'],
  ['CommercialRent', 'https://ahmedabad.technoproperty.in/CommercialRent.php', 'Commercial Rent'],
  ['CommercialSell', 'https://ahmedabad.technoproperty.in/CommercialSell.php', 'Commercial Sell'],
];

const out = [];
for (const [name, url, category] of categories) {
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 100000 });
  } catch (e) { console.log(name, 'nav warning'); }

  let info = null;
  for (let i = 0; i < 30; i++) {
    await page.waitForTimeout(1500);
    info = await page.evaluate(() => {
      try {
        const t = $('#tblpropertylisting').DataTable();
        const pi = t.page.info();
        if (pi.recordsTotal > 0) {
          return { recordsTotal: pi.recordsTotal, recordsDisplay: pi.recordsDisplay, pages: pi.pages, rowsPage: t.rows().count() };
        }
        return null;
      } catch { return null; }
    });
    if (info?.recordsTotal) break;
  }

  // extract the embedded propertytype GUID from the page source
  let guid = null;
  try {
    const src = await page.content();
    const m = src.match(/propertytype["']?\s*[:=]\s*["']([0-9a-f-]{36})/i);
    if (m) guid = m[1];
    else {
      const m2 = src.match(new RegExp('propertytype', 'g'));
      guid = m2 ? `(${m2.length} refs)` : 'none';
    }
  } catch {}
  out.push({ category, name, ...(info ?? { recordsTotal: -1 }), guid });
  console.log(`${name}: recordsTotal=${info?.recordsTotal ?? 'FAIL'} pages=${info?.pages ?? '?'} guid=${guid}`);
}

writeFileSync('tp-category-scope.json', JSON.stringify(out, null, 2));
await context.close();