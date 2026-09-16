import { Camoufox } from 'camoufox-js';
import { ensureLoggedIn } from './technoproperty/lib/browser.mjs';

const PROFILE_DIR = 'C:\\Users\\Mishay\\.camofox\\profiles\\b30a0e34683cf2594ffa4b9f9b2379d3';
const BASE_URL = 'https://ahmedabad.technoproperty.in';

const PAGES = [
  { name: 'dashboard', url: '/dashboard.php' },
  { name: 'filteredPropList', url: '/filteredPropList.php' },
  { name: 'ResidentialRent', url: '/ResidentialRent.php' },
  { name: 'ResidentialSell', url: '/ResidentialSell.php' },
  { name: 'CommercialRent', url: '/CommercialRent.php' },
  { name: 'CommercialSell', url: '/CommercialSell.php' },
  { name: 'listproperty', url: '/listproperty.php' },
  { name: 'brokersproperty-RR', url: '/brokersproperty.php?proptype=ResidentialRent' },
  { name: 'brokersproperty-PlotLandRent', url: '/brokersproperty.php?proptype=PlotAndLandRent' },
  { name: 'premiumPropList', url: '/premiumPropList.php' },
  { name: 'importantPropList', url: '/importantPropList.php' },
  { name: 'topareadata', url: '/topareadata.php' },
  { name: 'notifications', url: '/notifications.php' },
  { name: 'suggestions', url: '/suggestions.php' },
  { name: 'updateprofile', url: '/updateprofile.php' },
];

async function main() {
  const context = await Camoufox({ headless: false, user_data_dir: PROFILE_DIR });
  const page = await context.newPage();
  await ensureLoggedIn(page, BASE_URL);

  for (const p of PAGES) {
    const calls = [];
    const reqHandler = (req) => {
      const url = req.url();
      if (url.includes('.php') && url.includes(BASE_URL)) {
        const path = url.replace(BASE_URL, '');
        calls.push({ m: req.method(), p: path, d: req.postData() || null });
      }
    };
    page.on('request', reqHandler);
    await page.goto(`${BASE_URL}${p.url}`, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(3500);
    page.off('request', reqHandler);

    const state = await page.evaluate(() => {
      const out = {
        title: document.title,
        url: location.href,
        hasTable: !!document.querySelector('#tblpropertylisting'),
        dt: null,
        brokerMode: null,
      };
      try { out.dt = $('#tblpropertylisting').DataTable().page.info(); } catch { }
      const bm = document.querySelector('[data-broker-mode]');
      if (bm) out.brokerMode = bm.getAttribute('data-broker-mode');
      return out;
    }).catch(() => ({ title: 'ERR', url: page.url(), hasTable: false }));

    console.log(`\n=== ${p.name} ===`);
    console.log(`  title=${state.title} hasTable=${state.hasTable} brokerMode=${state.brokerMode}`);
    if (state.dt) console.log(`  dt=${JSON.stringify(state.dt)}`);
    const uniq = {};
    for (const c of calls) {
      const key = c.m + ' ' + c.p.split('?')[0];
      if (!uniq[key]) uniq[key] = c;
    }
    for (const c of Object.values(uniq)) {
      console.log(`  REQ ${c.m} ${c.p.split('?')[0]}${c.d ? '  POST:' + c.d.slice(0, 180) : ''}`);
    }
  }

  await context.close();
}

main().catch(err => { console.error('FATAL:', err.message); process.exit(1); });