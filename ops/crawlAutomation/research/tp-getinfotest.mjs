import { Camoufox } from 'camoufox-js';
import { ensureLoggedIn } from './technoproperty/lib/browser.mjs';

const PROFILE_DIR = 'C:\\Users\\Mishay\\.camofox\\profiles\\b30a0e34683cf2594ffa4b9f9b2379d3';
const BASE_URL = 'https://ahmedabad.technoproperty.in';

async function main() {
  const context = await Camoufox({ headless: false, user_data_dir: PROFILE_DIR });
  const page = await context.newPage();
  await ensureLoggedIn(page, BASE_URL);
  await page.goto(`${BASE_URL}/ResidentialRent.php`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(5000);

  const btnId = await page.evaluate(() => {
    const b = document.querySelector('[id^="getcntinfo_"]');
    return b ? b.id : null;
  });
  console.log('button id:', btnId);

  if (btnId) {
    for (const proprowVal of [btnId, btnId.replace('getcntinfo_', '')]) {
      const r = await page.evaluate(async ({ u, proprow }) => {
        const res = await fetch(u, {
          method: 'POST', credentials: 'same-origin', cache: 'no-store',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', 'X-Requested-With': 'XMLHttpRequest' },
          body: `proprow=${proprow}&ajax=true`,
        });
        const text = await res.text();
        return { status: res.status, text: text.slice(0, 600) };
      }, { u: BASE_URL + '/ajaxgetinfo.php', proprow: proprowVal });
      console.log(`\nproprow="${proprowVal}":`, r.status, r.text);
    }
  }

  await context.close();
}

main().catch(err => { console.error('FATAL:', err.message); process.exit(1); });