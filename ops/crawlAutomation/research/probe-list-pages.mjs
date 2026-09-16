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

const posts = [];
page.on('request', req => {
  if (req.method() === 'POST') posts.push({ url: req.url(), body: (req.postData() || '').slice(0, 240) });
});

async function load(url) {
  try { await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 100000 }); } catch {}
  await page.waitForTimeout(6000);
}

// Premium page internals
await load('https://ahmedabad.technoproperty.in/premiumPropList.php');
const premium = await page.evaluate(() => {
  const out = { url: location.href, title: document.title };
  const table = document.getElementById('tblpropertylisting');
  out.hasTable = !!table;
  if (table) {
    try {
      const t = $('#tblpropertylisting').DataTable();
      out.info = t.page.info();
      out.dataLoaded = t.rows().count();
    } catch (e) { out.err = String(e); }
  }
  // inline initial listing script
  const s = document.querySelector('script#initiallisting, script[data-initial]');
  out.initialScript = s ? s.textContent.slice(0, 600) : null;
  // any element with propertytype or category
  out.props = {};
  for (const el of document.querySelectorAll('[id*="Category"],[id*="propertytype"],[name*="propertytype"],[id*="Initial"],input[type=hidden]')) {
    out.props[el.id || el.name] = (el.value || el.textContent || '').slice(0, 120);
  }
  return out;
});
console.log('=== PREMIUM ===');
console.log(JSON.stringify(premium, null, 2));
console.log('premium posts so far:', JSON.stringify(posts.filter(p => p.url.includes('property')).slice(0, 12), null, 2));

// Important page
posts.length = 0;
await load('https://ahmedabad.technoproperty.in/importantPropList.php');
const important = await page.evaluate(() => {
  const out = { url: location.href, title: document.title };
  try {
    const t = $('#tblpropertylisting').DataTable();
    out.info = t.page.info();
  } catch (e) { out.err = String(e); }
  const hiddens = {};
  for (const el of document.querySelectorAll('input[type=hidden],#propertyListCategoryId,#propertyListCategoryName')) {
    hiddens[el.id || el.name || 'x'] = (el.value || '').slice(0, 120);
  }
  out.hiddens = hiddens;
  return out;
});
console.log('\n=== IMPORTANT ===');
console.log(JSON.stringify(important, null, 2));
console.log('important posts:', JSON.stringify(posts.filter(p => p.url.includes('property')).slice(0, 12), null, 2));

// All properties page (listproperty.php)
posts.length = 0;
await load('https://ahmedabad.technoproperty.in/listproperty.php');
const all = await page.evaluate(() => {
  const out = { url: location.href, title: document.title };
  try {
    const t = $('#tblpropertylisting').DataTable();
    out.info = t.page.info();
  } catch (e) { out.err = String(e); }
  const hiddens = {};
  for (const el of document.querySelectorAll('input[type=hidden],#propertyListCategoryId,#propertyListCategoryName')) {
    hiddens[el.id || el.name || 'x'] = (el.value || '').slice(0, 120);
  }
  out.hiddens = hiddens;
  return out;
});
console.log('\n=== ALL PROPERTIES (listproperty.php) ===');
console.log(JSON.stringify(all, null, 2));
console.log('all posts:', JSON.stringify(posts.filter(p => p.url.includes('property')).slice(0, 12), null, 2));

writeFileSync('tp-list-page-internals.json', JSON.stringify({ premium, important, all }, null, 2));
await context.close();