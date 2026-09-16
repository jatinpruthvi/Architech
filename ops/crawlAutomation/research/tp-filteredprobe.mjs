import { Camoufox } from 'camoufox-js';
import { ensureLoggedIn } from './technoproperty/lib/browser.mjs';

const PROFILE_DIR = 'C:\\Users\\Mishay\\.camofox\\profiles\\b30a0e34683cf2594ffa4b9f9b2379d3';
const BASE_URL = 'https://ahmedabad.technoproperty.in';

async function main() {
  const context = await Camoufox({ headless: false, user_data_dir: PROFILE_DIR });
  const page = await context.newPage();
  await ensureLoggedIn(page, BASE_URL);

  const calls = [];
  page.on('request', (req) => {
    const url = req.url();
    if (url.includes('.php') && url.includes(BASE_URL)) {
      calls.push({ url, m: req.method(), d: req.postData() || null });
    }
  });

  await page.goto(BASE_URL + '/filteredPropList.php', { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(5000);
  page.off('request', () => {});

  const phpCalls = calls.filter(c => c.url.includes('.php') && !c.url.includes('detectdevice') && !c.url.includes('favicon'));
  for (const c of phpCalls) {
    const path = c.url.replace(BASE_URL, '');
    console.log(`${c.m} ${path}${c.d ? '  POST:' + c.d.slice(0, 300) : ''}`);
  }

  await context.close();
}

main().catch(err => { console.error('FATAL:', err.message); process.exit(1); });