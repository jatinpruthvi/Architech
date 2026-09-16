import { Camoufox } from 'camoufox-js';
import { ensureLoggedIn } from './technoproperty/lib/browser.mjs';

const PROFILE_DIR = 'C:\\Users\\Mishay\\.camofox\\profiles\\b30a0e34683cf2594ffa4b9f9b2379d3';
const BASE_URL = 'https://ahmedabad.technoproperty.in';
const show = (label, obj) => {
  const s = typeof obj === 'string' ? obj : JSON.stringify(obj);
  console.log(`=== ${label}:\n${s.slice(0, 700)}`);
};
const jsonFetch = async (page, path, body) => page.evaluate(async ({ baseUrl, path, body }) => {
  const opts = { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/x-www-form-urlencoded' } };
  if (body) opts.body = body;
  else opts.method = 'GET';
  const res = await fetch(baseUrl + path, opts);
  const text = await res.text();
  let data; try { data = JSON.parse(text); } catch { data = null; }
  return { status: res.status, data, text: text.slice(0, 500) };
}, { baseUrl: BASE_URL, path, body });

async function main() {
  const context = await Camoufox({ headless: false, user_data_dir: PROFILE_DIR });
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  await ensureLoggedIn(page, BASE_URL);

  // Load RR table, grab anchors + row HTML
  await page.goto(`${BASE_URL}/ResidentialRent.php`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  for (let i = 0; i < 30; i++) {
    await page.waitForTimeout(1000);
    const ok = await page.evaluate(() => { try { return $('#tblpropertylisting').DataTable().page.info().recordsTotal > 0; } catch { return false; } });
    if (ok) break;
  }

  const anchors = await page.evaluate(() => {
    const getcnt = document.querySelector('[id^="getcntinfo_"]');
    const moreInfo = document.querySelector('[id^="showMoreInfo_"]');
    const whatsapp = document.querySelector('[id^="wtsappid_"]');
    const imgBtn = document.querySelector('[id^="img_"], [data-gallery]');
    const rows = Array.from(document.querySelectorAll('#tblpropertylisting tbody tr:not(.dt-empty)'));
    const firstRow = rows[0];
    const rowIds = firstRow ? {
      dataPropId: firstRow.getAttribute('data-propid') || firstRow.dataset.propid,
      rowId: firstRow.id,
    } : null;
    return {
      contactBtnId: getcnt ? getcnt.id : null,
      moreInfoId: moreInfo ? moreInfo.id : null,
      whatsappId: whatsapp ? whatsapp.id : null,
      imgBtnId: imgBtn ? imgBtn.id : null,
      imgGallery: imgBtn ? !!imgBtn.dataset.gallery : null,
      rowIds,
      allBtnIds: firstRow ? Array.from(firstRow.querySelectorAll('[id]')).map(e => e.id).slice(0, 15) : [],
      firstRowHTML: firstRow ? firstRow.outerHTML.slice(0, 900) : null,
    };
  });
  show('RR anchors', anchors);

  // --- TEST ALL ENDPOINTS ---

  // 1. ajaxsavedsearch
  show('GET ajaxsavedsearch?action=list', await jsonFetch(page, '/ajaxsavedsearch.php?action=list'));

  // 2. ajaxpropertydatatable main with correct full params
  const mainBody = new URLSearchParams({
    draw: '1', start: '0', length: '3',
    searchvalue: 'all', propertytype: 'c7f77b53-1a4c-4fe7-1c9e-5147f5e13535',
    countcategory: 'Residential Rent', initiallisting: '1',
    'order[0][column]': '3', 'order[0][dir]': 'desc',
    'listingsearch': '', 'premise': '',
  }).toString();
  show('POST ajaxpropertydatatable (3 rows)', await jsonFetch(page, '/ajaxpropertydatatable.php', mainBody));

  // 3. ajaxpremiumpropdatatable (minimal — page uses columns defs, test minimal first)
  const premBody = new URLSearchParams({
    draw: '1', start: '0', length: '2',
    premium_filter: 'premiumproperty', searchvalue: '',
  }).toString();
  show('POST ajaxpremiumpropdatatable (2 rows)', await jsonFetch(page, '/ajaxpremiumpropdatatable.php', premBody));

  // 4. ajaximppropdatatable
  const impBody = new URLSearchParams({
    draw: '1', start: '0', length: '2', searchvalue: '',
  }).toString();
  show('POST ajaximppropdatatable (2 rows)', await jsonFetch(page, '/ajaximppropdatatable.php', impBody));

  // 5. ajaxgetinfo with correct id
  if (anchors.contactBtnId) {
    show('POST ajaxgetinfo', await jsonFetch(page, '/ajaxgetinfo.php', new URLSearchParams({ proprow: anchors.contactBtnId, ajax: 'true' }).toString()));
  }

  // 6. ajaxgetimages with propid from data attribute
  const imgPropId = await page.evaluate(() => {
    const btn = document.querySelector('[id^="img_"]');
    if (btn) return btn.id.replace(/^img_/, '');
    const row = document.querySelector('#tblpropertylisting tbody tr:not(.dt-empty)');
    const allIds = Array.from(row.querySelectorAll('[id]')).map(e => e.id);
    const imgId = allIds.find(i => i.startsWith('img_'));
    return imgId ? imgId.replace(/^img_/, '') : null;
  });
  if (imgPropId) {
    show('POST ajaxgetimages', await jsonFetch(page, '/ajaxgetimages.php', new URLSearchParams({ propertyId: imgPropId, ajax: 'true' }).toString()));
  }

  // 7. ajaxMorePropInfo (need a propInfoDetail value)
  if (anchors.moreInfoId) {
    show('POST ajaxMorePropInfo', await jsonFetch(page, '/ajaxMorePropInfo.php', new URLSearchParams({ propInfoDetail: anchors.moreInfoId, ajax: 'true', show: 'true' }).toString()));
  }

  // 8. ajaxgetwhatsappmsg
  if (anchors.whatsappId) {
    show('POST ajaxgetwhatsappmsg', await jsonFetch(page, '/ajaxgetwhatsappmsg.php', new URLSearchParams({ wtsappid: anchors.whatsappId, ajax: 'true' }).toString()));
  }

  // 9. ajaxpropnoteupdate (read-only view only)
  const noteBtn = await page.evaluate(() => {
    const btn = document.querySelector('.dt-note-col, [data-note]');
    return btn ? btn.id || btn.className.slice(0, 60) : null;
  });
  show('note marker', { noteBtn });

  // 10. ajaxpaginationlist with nomenu=true&ajax=true (blanket load)
  show('POST ajaxpaginationlist (nomenu=true)', await jsonFetch(page, '/ajaxpaginationlist.php', new URLSearchParams({ nomenu: 'true', ajax: 'true' }).toString()));

  // 11. brokerpropertycount
  show('GET brokerpropertycount', await jsonFetch(page, '/brokerpropertycount.php'));

  // 12. ajaxbrokerareacount (GET seen in pageprobe)
  show('GET ajaxbrokerareacount', await jsonFetch(page, '/ajaxbrokerareacount.php'));

  // 13. ajaxdetectdevice (from page probe)
  show('POST ajaxdetectdevice', await jsonFetch(page, '/ajaxdetectdevice.php', new URLSearchParams({ pagename: 'Test', browsername: 'Firefox', browserver: '152', osname: 'Windows 10', devicename: '', ajax: 'true' }).toString()));

  // 14. ajaxrentedoutprop (flag flip - just probe response shape with dummy propid, expect fail/permission)
  show('POST ajaxrentedoutprop (test)', await jsonFetch(page, '/ajaxrentedoutprop.php', new URLSearchParams({ propertyId: 'test', propchecked: 'true', ajax: 'true' }).toString()));

  // 15. ajaxlistproperty (mark as listed - expect permission fail)
  show('POST ajaxlistproperty (test)', await jsonFetch(page, '/ajaxlistproperty.php', new URLSearchParams({ propertyId: 'test', propchecked: 'true', ajax: 'true' }).toString()));

  await context.close();
}

main().catch(err => { console.error('FATAL:', err.message); process.exit(1); });