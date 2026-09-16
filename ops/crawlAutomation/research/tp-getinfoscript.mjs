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

  // Dump the raw button HTML and any JS referencing getcntinfo / getinfo / ajaxgetinfo
  const info = await page.evaluate(() => {
    const btn = document.querySelector('[id^="getcntinfo_"]');
    let btnHtml = null;
    if (btn) btnHtml = btn.outerHTML;

    const scripts = [...document.querySelectorAll('script')].map(s => s.textContent || '');
    const refs = scripts
      .map(t => ({
        hasGetcnt: t.includes('getcntinfo'),
        hasAjaxgetinfo: t.includes('ajaxgetinfo'),
        hasGetinfo: t.includes('getinfo'),
        text: t,
      }))
      .filter(r => r.hasGetcnt || r.hasAjaxgetinfo);
    return { btnHtml, refs: refs.map(r => ({ flags: { g: r.hasGetcnt, a: r.hasAjaxgetinfo, i: r.hasGetinfo }, extent: r.text.length, snippet: (r.text.match(/.{0,200}(getcntinfo|ajaxgetinfo|getinfo).{0,400}/s) || [])[0]?.slice(0, 600) })) };
  });
  console.log('BUTTON HTML:', info.btnHtml);
  console.log('SCRIPTS:');
  for (const r of info.refs) {
    console.log('  flags=', JSON.stringify(r.flags), 'len=', r.extent);
    console.log('  snippet=', r.snippet);
  }

  await context.close();
}

main().catch(err => { console.error('FATAL:', err.message); process.exit(1); });