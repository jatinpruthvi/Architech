import { Camoufox } from 'camoufox-js';
import { ensureLoggedIn } from './technoproperty/lib/browser.mjs';

const PROFILE_DIR = 'C:\\Users\\Mishay\\.camofox\\profiles\\b30a0e34683cf2594ffa4b9f9b2379d3';
const BASE_URL = 'https://ahmedabad.technoproperty.in';
const show = (label, obj) => {
  const s = typeof obj === 'string' ? obj : JSON.stringify(obj);
  console.log(`=== ${label}:\n${s.slice(0, 800)}`);
};
const jfetch = async (page, path, body) => page.evaluate(async ({ baseUrl, path, body }) => {
  const opts = { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/x-www-form-urlencoded' } };
  if (body) opts.body = body; else opts.method = 'GET';
  const res = await fetch(baseUrl + path, opts);
  const text = await res.text();
  let data; try { data = JSON.parse(text); } catch { data = null; }
  return { status: res.status, data, text: text.slice(0, 600) };
}, { baseUrl: BASE_URL, path, body });

async function main() {
  const context = await Camoufox({ headless: false, user_data_dir: PROFILE_DIR });
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  await ensureLoggedIn(page, BASE_URL);

  await page.goto(`${BASE_URL}/ResidentialRent.php`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  for (let i = 0; i < 30; i++) {
    await page.waitForTimeout(1000);
    const ok = await page.evaluate(() => { try { return $('#tblpropertylisting').DataTable().page.info().recordsTotal > 0; } catch { return false; } });
    if (ok) break;
  }

  // Scan ALL rendered rows for the two endpoints' trigger elements
  const anchors = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('#tblpropertylisting tbody tr:not(.dt-empty)'));
    const found = { moreInfo: [], whatsapp: [], propIds: [], imgBtns: [] };
    for (const r of rows) {
      const ids = Array.from(r.querySelectorAll('[id]')).map(e => e.id);
      const mi = ids.find(i => i.startsWith('showMoreInfo_'));
      const wa = ids.find(i => i.startsWith('wtsappid_') || i.startsWith('whatsapp'));
      const pid = r.getAttribute('data-propid');
      const img = ids.find(i => i.startsWith('img_'));
      if (mi) found.moreInfo.push(mi);
      if (wa) found.whatsapp.push(wa);
      if (pid) found.propIds.push(pid);
      if (img) found.imgBtns.push(img);
      if (found.moreInfo.length > 1 && found.whatsapp.length > 1 && found.imgBtns.length > 1) break;
    }
    // Also dump full HTML of first row that HAS a showMoreInfo element
    const firstWithMore = rows.find(r => r.querySelector('[id^="showMoreInfo_"]'));
    const waHTML = rows.find(r => Array.from(r.querySelectorAll('[id]')).some(e => e.id.startsWith('wtsappid_') || e.id.startsWith('whatsapp')));
    return {
      moreInfo: found.moreInfo.slice(0, 3),
      whatsapp: found.whatsapp.slice(0, 3),
      propIds: found.propIds.slice(0, 3),
      imgBtns: found.imgBtns.slice(0, 3),
      rowWithMore: firstWithMore ? firstWithMore.outerHTML.slice(0, 1400) : null,
      rowWithWa: waHTML ? waHTML.querySelector('[id^="wtsappid_"], [id^="whatsapp"]').outerHTML.slice(0, 400) : null,
    };
  });
  show('anchors', anchors);

  // test ajaxMorePropInfo if we have an element
  if (anchors.moreInfo && anchors.moreInfo.length) {
    const id = anchors.moreInfo[0];
    show(`POST ajaxMorePropInfo (${id})`, await jfetch(page, '/ajaxMorePropInfo.php', new URLSearchParams({ propInfoDetail: id, ajax: 'true', show: 'true' }).toString()));
  }
  // test ajaxgetwhatsappmsg
  if (anchors.whatsapp && anchors.whatsapp.length) {
    const id = anchors.whatsapp[0];
    show(`POST ajaxgetwhatsappmsg (${id})`, await jfetch(page, '/ajaxgetwhatsappmsg.php', new URLSearchParams({ wtsappid: id, ajax: 'true' }).toString()));
  }
  // test ajaxgetimages with a real propertyId
  if (anchors.imgBtns && anchors.imgBtns.length) {
    const pid = anchors.imgBtns[0].replace(/^img_/, '');
    show(`POST ajaxgetimages (pid=${pid})`, await jfetch(page, '/ajaxgetimages.php', new URLSearchParams({ propertyId: pid, ajax: 'true' }).toString()));
  }

  await context.close();
}

main().catch(err => { console.error('FATAL:', err.message); process.exit(1); });