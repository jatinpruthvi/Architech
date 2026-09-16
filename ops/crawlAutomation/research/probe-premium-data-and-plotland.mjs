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

// ---------- Premium: capture all POSTs to any .php ----------
const posts = [];
page.on('request', req => {
  if (req.method() !== 'POST') return;
  const url = req.url();
  if (/\.php/.test(url)) {
    posts.push({ url: url.split('?')[0].split('/').pop(), body: (req.postData() || '').slice(0, 300) });
  }
});
try { await page.goto('https://ahmedabad.technoproperty.in/premiumPropList.php', { waitUntil: 'domcontentloaded', timeout: 100000 }); } catch {}
for (let i = 0; i < 25; i++) {
  await page.waitForTimeout(1000);
  const ok = await page.evaluate(() => { try { return $('#tblpropertylisting').DataTable().page.info().recordsTotal > 0; } catch { return false; } });
  if (ok) break;
}
const premData = await page.evaluate(() => {
  const t = $('#tblpropertylisting').DataTable();
  const pi = t.page.info();
  const row0 = t.row(0).data();
  return {
    total: pi.recordsTotal,
    row0: row0 ? Object.fromEntries(Object.entries(row0).map(([k, v]) => [k, String(v).slice(0, 150)])) : null,
    guidInput: (document.getElementById('propertyListCategoryId') || {}).value,
    catName: (document.getElementById('propertyListCategoryName') || {}).value,
  };
});
console.log('=== premium POSTs ===');
console.log(JSON.stringify(posts.filter(p => ['ajaxpropertydatatable.php', 'ajaxpropnotebulk.php'].includes(p.url)).slice(0, 10), null, 2));
console.log('=== premium data ===');
console.log(JSON.stringify(premData, null, 2));
writeFileSync('tp-premium-data.json', JSON.stringify(premData, null, 2));

// ---------- Plot & Land: dump card DOM ----------
posts.length = 0;
try { await page.goto('https://ahmedabad.technoproperty.in/brokersproperty.php?proptype=PlotAndLandRent', { waitUntil: 'domcontentloaded', timeout: 100000 }); } catch {}
await page.waitForTimeout(4000);
const pal = await page.evaluate(() => {
  // the bookmark cards
  const main = document.querySelector('.app-main, main, .card') || document.body;
  const html = main.innerHTML;
  const idx = html.search(/bkmc0/);
  return {
    aroundCard0: (idx !== -1 ? html.slice(Math.max(0, idx - 3000), idx + 200) : html.slice(0, 3000)),
  };
});
console.log('\n=== PlotAndLand card0 html ===');
console.log(pal.aroundCard0.slice(0, 6000));
writeFileSync('tp-plotland-card.html', pal.aroundCard0);

await context.close();