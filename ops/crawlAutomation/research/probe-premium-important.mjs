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

async function analyze(url, label) {
  const requestBodies = [];
  page.on('request', req => {
    if (req.url().includes('ajaxpropertydatatable') && req.method() === 'POST') {
      requestBodies.push(req.postData() || '');
    }
  });
  try { await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 100000 }); } catch {}
  for (let i = 0; i < 30; i++) {
    await page.waitForTimeout(1200);
    const ok = await page.evaluate(() => {
      try { return $('#tblpropertylisting').DataTable().page.info().recordsTotal > 0; } catch { return false; }
    });
    if (ok) break;
  }
  page.removeAllListeners('request');
  const meta = await page.evaluate(() => {
    // find every element with value that looks like a guid, and the initial listing promise/reference
    const els = Array.from(document.querySelectorAll('input,select')).filter(i => i.value && /^[0-9a-f-]{36}$/i.test(i.value));
    const table = document.getElementById('tblpropertylisting');
    let tableHasAttrs = false;
    let dtConfigHint = null;
    if (table) {
      tableHasAttrs = true;
    }
    return {
      title: document.title,
      guidInputs: els.map(i => ({ id: i.id, name: i.name, value: i.value })),
      hasTable: tableHasAttrs,
      dtInfo: (() => { try { return { total: $('#tblpropertylisting').DataTable().page.info().recordsTotal }; } catch { return null; } })(),
    };
  });
  console.log(`\n=== ${label} (${url}) ===`);
  console.log('POST bodies to ajaxpropertydatatable:', JSON.stringify(requestBodies, null, 2));
  console.log('meta:', JSON.stringify(meta, null, 2));
  writeFileSync(`tp-${label}-meta.json`, JSON.stringify({ requestBodies, meta }, null, 2));
}

await analyze('https://ahmedabad.technoproperty.in/premiumPropList.php', 'premium');

let counter = 0;
page.on('request', req => {
  if (req.url().includes('ajaxpropertydatatable') && req.method() === 'POST') {
    const b = req.postData() || '';
    if (counter++ < 2) console.log('IMPORTANT req body:', b);
  }
});
try { await page.goto('https://ahmedabad.technoproperty.in/importantPropList.php', { waitUntil: 'domcontentloaded', timeout: 100000 }); } catch {}
await page.waitForTimeout(8000);

// Also check plot-and-land page layout directly
try { await page.goto('https://ahmedabad.technoproperty.in/brokersproperty.php?proptype=PlotAndLandRent', { waitUntil: 'domcontentloaded', timeout: 100000 }); } catch {}
await page.waitForTimeout(5000);
const pal = await page.evaluate(() => {
  const cards = Array.from(document.querySelectorAll('[data-propid], .property-card, .card-item, .prop-item'));
  const links = Array.from(document.querySelectorAll('a')).filter(a => !a.href.startsWith('javascript')).map(a => a.getAttribute('href')).filter(Boolean);
  const uniq = [...new Set(links)].slice(0, 40);
  const tables = document.querySelectorAll('table').length;
  const bodyText = document.body.innerText.slice(0, 500);
  return {
    title: document.title,
    cardSelectors: { dataPropid: cards.length, tables, bodyText },
    sampleLinks: uniq,
    hasDataTable: !!window.$?.fn?.dataTable?.isDataTable?.('#tblpropertylisting'),
  };
});
console.log('\n=== PlotAndLandRent layout ===');
console.log(JSON.stringify(pal, null, 2));
writeFileSync('tp-plotland-meta.json', JSON.stringify(pal, null, 2));

await context.close();