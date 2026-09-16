import { Camoufox } from 'camoufox-js';
import { ensureLoggedIn } from './technoproperty/lib/browser.mjs';

const PROFILE_DIR = 'C:\\Users\\Mishay\\.camofox\\profiles\\b30a0e34683cf2594ffa4b9f9b2379d3';
const BASE_URL = 'https://ahmedabad.technoproperty.in';

const PAGES = [
  { key: 'ResidentialRent', url: '/ResidentialRent.php', ajax: '/ajaxpropertydatatable.php' },
  { key: 'ResidentialSell', url: '/ResidentialSell.php', ajax: '/ajaxpropertydatatable.php' },
  { key: 'CommercialRent', url: '/CommercialRent.php', ajax: '/ajaxpropertydatatable.php' },
  { key: 'CommercialSell', url: '/CommercialSell.php', ajax: '/ajaxpropertydatatable.php' },
  { key: 'Premium', url: '/premiumPropList.php', ajax: '/ajaxpremiumpropdatatable.php' },
  { key: 'Important', url: '/importantPropList.php', ajax: '/ajaximppropdatatable.php' },
];

async function main() {
  const context = await Camoufox({ headless: false, user_data_dir: PROFILE_DIR });
  const page = await context.newPage();
  await ensureLoggedIn(page, BASE_URL);

  for (const p of PAGES) {
    let captured = null;
    page.on('request', (req) => {
      if (req.method() === 'POST' && new URL(req.url()).pathname === p.ajax) {
        captured = req.postData();
      }
    });
    await page.goto(`${BASE_URL}${p.url}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(5000);
    const dtInfo = await page.evaluate(() => {
      try { return $('#tblpropertylisting').DataTable().page.info(); } catch (e) { return null; }
    });
    console.log(`\n=== ${p.key} ===`);
    console.log('  page.info():', JSON.stringify(dtInfo));
    console.log('  captured POST body:', captured);
  }

  await context.close();
}

main().catch(err => { console.error('FATAL:', err.message); process.exit(1); });