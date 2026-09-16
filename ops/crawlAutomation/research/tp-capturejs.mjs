import { Camoufox } from 'camoufox-js';
import { ensureLoggedIn } from './technoproperty/lib/browser.mjs';
import { writeFileSync, mkdirSync } from 'fs';
import { resolve } from 'path';

const PROFILE_DIR = 'C:\\Users\\Mishay\\.camofox\\profiles\\b30a0e34683cf2594ffa4b9f9b2379d3';
const BASE_URL = 'https://ahmedabad.technoproperty.in';
const OUT = resolve('E:\\Jatin-Project\\Broker\\BrainStrom\\automation\\technoproperty\\probe2');

async function main() {
  mkdirSync(OUT, { recursive: true });
  const context = await Camoufox({ headless: false, user_data_dir: PROFILE_DIR });
  const page = await context.newPage();
  await ensureLoggedIn(page, BASE_URL);

  const jsBodies = [];
  page.on('response', async (resp) => {
    const url = resp.url();
    if (resp.status() === 200 && url.includes(BASE_URL) && /\.js(\?|$)/.test(url)) {
      try {
        const text = await resp.text();
        jsBodies.push({ url, text });
      } catch { /* ignore */ }
    }
  });

  await page.goto(`${BASE_URL}/ResidentialRent.php`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(5000);

  let i = 0;
  for (const b of jsBodies) {
    const name = b.url.split('?')[0].split('/').pop() || `js${i}.js`;
    writeFileSync(resolve(OUT, `${i}-${name}`), b.text);
    console.log(`saved ${i}-${name} (${b.text.length} bytes) from ${b.url}`);
    i++;
  }
  console.log(`\nTotal JS bodies captured: ${jsBodies.length}`);

  await context.close();
}

main().catch(err => { console.error('FATAL:', err.message); process.exit(1); });