import { Camoufox } from 'camoufox-js';
import { ensureLoggedIn } from './technoproperty/lib/browser.mjs';
import { writeFileSync, mkdirSync } from 'fs';
import { resolve } from 'path';

const PROFILE_DIR = 'C:\\Users\\Mishay\\.camofox\\profiles\\b30a0e34683cf2594ffa4b9f9b2379d3';
const BASE_URL = 'https://ahmedabad.technoproperty.in';
const OUT = resolve('E:\\Jatin-Project\\Broker\\BrainStrom\\automation\\technoproperty\\probe3');

const SRC_LIST = [
  '/assets/js/pages/propertyList.js?ver=1787594544',
  '/assets/js/datatable-listing.min.js?ver=1787081882',
  '/assets/common.min.js?ver=1786979622',
  '/assets/restrict.js?ver=1787081247',
  '/assets/protect.js?ver=1786787264',
  '/assets/js/form-common.min.js',
  '/assets/js/common.min.js',
];

async function main() {
  mkdirSync(OUT, { recursive: true });
  const context = await Camoufox({ headless: false, user_data_dir: PROFILE_DIR });
  const page = await context.newPage();
  await ensureLoggedIn(page, BASE_URL);
  await page.goto(`${BASE_URL}/ResidentialRent.php`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(4000);

  const pageUrl = page.url();
  for (let i = 0; i < SRC_LIST.length; i++) {
    const url = SRC_LIST[i].startsWith('http') ? SRC_LIST[i] : BASE_URL + SRC_LIST[i];
    const r = await page.evaluate(async ({ u, ref }) => {
      const res = await fetch(u, {
        cache: 'no-store',
        credentials: 'same-origin',
        headers: { 'Referer': ref, 'Accept': '*/*' },
      });
      const text = await res.text();
      return { status: res.status, text, ct: res.headers.get('content-type') };
    }, { u: url, ref: pageUrl });
    const name = url.split('?')[0].split('/').pop() || `src${i}`;
    if (r.status === 200 && !r.text.startsWith('<!DOCTYPE HTML') && r.text.length > 100) {
      writeFileSync(resolve(OUT, `${i}-${name}`), r.text);
      console.log(`OK ${i}-${name} (${r.text.length} bytes) ct=${r.ct}`);
    } else {
      console.log(`X  ${i}-${name} status=${r.status} len=${r.text.length} ct=${r.ct} "${r.text.slice(0, 60).replace(/\s+/g, ' ')}"`);
    }
  }

  await context.close();
}

main().catch(err => { console.error('FATAL:', err.message); process.exit(1); });