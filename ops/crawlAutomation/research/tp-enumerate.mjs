import { Camoufox } from 'camoufox-js';
import { ensureLoggedIn } from './technoproperty/lib/browser.mjs';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve } from 'path';

const PROFILE_DIR = 'C:\\Users\\Mishay\\.camofox\\profiles\\b30a0e34683cf2594ffa4b9f9b2379d3';
const BASE_URL = 'https://ahmedabad.technoproperty.in';
const OUT = resolve('E:\\Jatin-Project\\Broker\\BrainStrom\\automation\\technoproperty\\probe');

async function main() {
  mkdirSync(OUT, { recursive: true });
  const context = await Camoufox({ headless: false, user_data_dir: PROFILE_DIR });
  const page = await context.newPage();
  await ensureLoggedIn(page, BASE_URL);

  await page.goto(`${BASE_URL}/ResidentialRent.php`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(4000);

  // Capture all ajax-ish requests made during page load
  const requests = [];
  page.on('request', (req) => {
    const url = req.url();
    if (url.includes('.php') && url.includes(BASE_URL)) {
      requests.push({ method: req.method(), url, post: req.postData() || null });
    }
  });

  // reload to capture the table's server request
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(4000);

  const scriptSrcs = await page.evaluate(() =>
    [...document.querySelectorAll('script[src]')].map(s => s.src).filter(Boolean)
  );

  const menuLinks = await page.evaluate(() => {
    const out = new Set();
    for (const a of document.querySelectorAll('a[href]')) {
      const h = a.href;
      if (h && h.includes('.php') && !h.startsWith('javascript:')) out.add(h);
    }
    return [...out];
  });

  console.log('SCRIPT SRCS:');
  for (const s of scriptSrcs) console.log('  ', s);
  console.log('\nMENU LINKS (.php):');
  for (const l of menuLinks) console.log('  ', l);
  console.log('\nREQUESTS (.php):');
  for (const r of requests) console.log('  ', r.method, r.url, r.post ? `POST[${r.post.slice(0, 120)}]` : '');

  // Fetch and save all local (same-origin) scripts for offline grep
  const localScripts = scriptSrcs.filter(s => s.includes(BASE_URL) || s.startsWith('/'));
  let saved = 0;
  for (const s of localScripts) {
    try {
      const res = await page.evaluate(async (url) => {
        const r = await fetch(url, { credentials: 'same-origin', cache: 'no-store' });
        return await r.text();
      }, { url: s });
      const name = s.split('?')[0].split('/').pop() || `s${saved}.js`;
      writeFileSync(resolve(OUT, `${saved}-${name}`), res);
      saved++;
    } catch (e) {
      console.log('  fetch failed:', s, e.message);
    }
  }

  // Inline scripts too
  const inline = await page.evaluate(() =>
    [...document.querySelectorAll('script:not([src])')].map(s => s.textContent).join('\n\n/*----*/\n\n')
  );
  writeFileSync(resolve(OUT, 'INLINE.html'), inline);

  console.log(`\nSaved ${saved} local scripts + inline to ${OUT}`);

  await context.close();
}

main().catch(err => { console.error('FATAL:', err.message); process.exit(1); });