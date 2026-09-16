import { Camoufox } from 'camoufox-js';
import { ensureLoggedIn } from './technoproperty/lib/browser.mjs';

const PROFILE_DIR = 'C:\\Users\\Mishay\\.camofox\\profiles\\b30a0e34683cf2594ffa4b9f9b2379d3';
const BASE_URL = 'https://ahmedabad.technoproperty.in';

const show = (label, obj) => {
  const s = typeof obj === 'string' ? obj : JSON.stringify(obj);
  console.log(`--- ${label}: ${s.slice(0, 500)}`);
};

async function main() {
  const context = await Camoufox({ headless: false, user_data_dir: PROFILE_DIR });
  const page = await context.newPage();
  page.setDefaultTimeout(30000);

  const ensure = async () => { await ensureLoggedIn(page, BASE_URL); };
  await ensure();

  // helper: run a fetch, detect login-redirect/401, re-login and retry once
  const doFetch = async (path, options, tries = 0) => {
    const r = await page.evaluate(async ({ baseUrl, path, options }) => {
      const opts = options || {};
      opts.credentials = 'same-origin';
      if (opts.body && !opts.headers) opts.headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
      const res = await fetch(baseUrl + path, opts);
      let text = await res.text();
      let data = null;
      if (opts.expectJson !== false) { try { data = JSON.parse(text); } catch { } }
      return { status: res.status, ct: res.headers.get('content-type'), text, data };
    }, { baseUrl: BASE_URL, path, options });
    const dead = r.text.startsWith('<!DOCTYPE HTML') || (r.status === 401 || r.status === 403) || (r.data && r.data.success === false);
    if (dead && tries === 0) { await ensure(); return doFetch(path, options, 1); }
    return r;
  };

  // 1. capture FULL premium/important POST bodies
  for (const nav of [
    { name: 'premium', url: '/premiumPropList.php' },
    { name: 'important', url: '/importantPropList.php' },
  ]) {
    let body = null;
    const onReq = (req) => { if (req.url().includes('datatable.php') && req.method() === 'POST') body = req.postData(); };
    page.on('request', onReq);
    await page.goto(BASE_URL + nav.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(3500);
    page.off('request', onReq);
    show(`${nav.name} datatable FULL POST`, body ? body.slice(0, 400) : '(none)');
  }

  // capture the distinctive tail of the premium/important POST (differs from main)
  const tail = (s) => (s ? s.slice(-420) : '(none)');
  // re-run just to show tails
  for (const nav of [
    { name: 'premium', url: '/premiumPropList.php' },
    { name: 'important', url: '/importantPropList.php' },
  ]) {
    let body = null;
    const onReq = (req) => { if (req.url().includes('datatable.php') && req.method() === 'POST') body = req.postData(); };
    page.on('request', onReq);
    await page.goto(BASE_URL + nav.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(2500);
    page.off('request', onReq);
    show(`${nav.name} POST tail`, tail(body));
  }

  // 2. load RR and grab anchors
  await ensure();
  await page.goto(BASE_URL + '/ResidentialRent.php', { waitUntil: 'domcontentloaded', timeout: 60000 });
  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(1000);
    const has = await page.evaluate(() => {
      try { return $('#tblpropertylisting').DataTable().page.info().recordsTotal > 0; } catch { return false; }
    });
    if (has) break;
  }
  const dom = await page.evaluate(() => {
    const mi = document.querySelector('[id^="showMoreInfo_"]');
    const wa = document.querySelector('[id^="wtsappid_"]');
    const cnt = document.querySelector('[id^="getcntinfo_"]');
    const row = document.querySelector('#tblpropertylisting tbody tr:not(.dt-empty)');
    return {
      moreInfoId: mi ? mi.id : null,
      whatsappId: wa ? wa.id : null,
      contactBtnId: cnt ? cnt.id : null,
      rowCells: row ? Array.from(row.cells).slice(0, 20).map(c => c.innerText.trim().slice(0, 40)) : null,
    };
  }).catch(e => ({ err: e.message }));
  show('RR row anchors', dom);

  // 3. GET endpoints
  await ensure();
  for (const ep of ['ajaxsavedsearch.php', 'brokerpropertycount.php', 'ajaxbrokerareacount.php']) {
    const r = await doFetch('/' + ep, { expectJson: false });
    show(`GET ${ep}`, { status: r.status, ct: r.ct, len: r.text.length, head: r.text.replace(/\s+/g, ' ').slice(0, 200) });
  }

  // 4. ajaxpaginationlist
  await ensure();
  const r1 = await doFetch('/ajaxpaginationlist.php', {
    method: 'POST',
    body: new URLSearchParams({ pagenum: '1', searchvalue: 'all', propertytype: '0' }).toString(),
    expectJson: false,
  });
  show('POST ajaxpaginationlist', { status: r1.status, ct: r1.ct, len: r1.text.length, hasBlock: r1.text.includes('tp-property-card') || r1.text.includes('property-card'), head: r1.text.replace(/\s+/g, ' ').slice(0, 250) });

  // 5. ajaxMorePropInfo
  if (dom.moreInfoId) {
    await ensure();
    const r2 = await doFetch('/ajaxMorePropInfo.php', {
      method: 'POST',
      body: new URLSearchParams({ propInfoDetail: dom.moreInfoId, ajax: 'true', show: 'true' }).toString(),
      expectJson: false,
    });
    show(`POST ajaxMorePropInfo (${dom.moreInfoId})`, { status: r2.status, len: r2.text.length, head: r2.text.replace(/\s+/g, ' ').slice(0, 300) });
  }

  // 6. ajaxgetwhatsappmsg
  if (dom.whatsappId) {
    await ensure();
    const r3 = await doFetch('/ajaxgetwhatsappmsg.php', {
      method: 'POST',
      body: new URLSearchParams({ wtsappid: dom.whatsappId, ajax: 'true' }).toString(),
      expectJson: false,
    });
    show(`POST ajaxgetwhatsappmsg (${dom.whatsappId})`, { status: r3.status, len: r3.text.length, head: r3.text.replace(/\s+/g, ' ').slice(0, 300) });
  }

  // 7. ajaxgetinfo sanity
  if (dom.contactBtnId) {
    await ensure();
    const r4 = await doFetch('/ajaxgetinfo.php', {
      method: 'POST',
      body: new URLSearchParams({ proprow: dom.contactBtnId, ajax: 'true' }).toString(),
    });
    show(`POST ajaxgetinfo (${dom.contactBtnId})`, r4.data || r4.text);
  }

  // 8. searchvalue variants on main datatable
  await ensure();
  for (const sv of ['all', 'deleted', 'uploaded', 'self']) {
    const body = new URLSearchParams({
      draw: '1', start: '0', length: '5',
      searchvalue: sv, propertytype: 'c7f77b53-1a4c-4fe7-1c9e-5147f5e13535',
      countcategory: 'Residential Rent', initiallisting: '1',
      'order[0][column]': '3', 'order[0][dir]': 'desc',
    }).toString();
    const r5 = await doFetch('/ajaxpropertydatatable.php', { method: 'POST', body });
    const n = r5.data && Array.isArray(r5.data.data) ? r5.data.data.length : 0;
    const total = r5.data && r5.data.recordsTotal != null ? r5.data.recordsTotal : null;
    show(`ajaxpropertydatatable searchvalue=${sv}`, { status: r5.status, rows: n, recordsTotal: total });
  }

  await context.close();
}

main().catch(err => { console.error('FATAL:', err.message); process.exit(1); });