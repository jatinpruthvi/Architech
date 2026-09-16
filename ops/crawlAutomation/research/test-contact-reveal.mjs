import { Camoufox } from 'camoufox-js';
import { writeFileSync } from 'node:fs';

const PROFILE_DIR = 'C:\\Users\\Mishay\\.camofox\\profiles\\b30a0e34683cf2594ffa4b9f9b2379d3';
const COOKIES = [
  { name: 'PHPSESSID', value: 'b93ndd1hh0206ve18a9ljlivgt', domain: 'ahmedabad.technoproperty.in', path: '/', secure: true, httpOnly: true },
  { name: 'screenWidth', value: '1098', domain: 'ahmedabad.technoproperty.in', path: '/', secure: true },
  { name: '_ga', value: 'GA1.1.986846689.1789451856', domain: '.technoproperty.in', path: '/', secure: true },
  { name: 'cf_clearance', value: 'EadqJbhvxxlLxr81LDmbcWK6gJMrdDwR5Rlnvj6x3v8-1789461733-1.2.1.1-0gSlTxx2Tyuqf5wvRuuNd.QFMQBcKVwy17amGom2Dgbtu9vVyVyAWwA2hvLQLpM0NwkUSMQ2jCUFKH5gJEcRy59SEi3aUG8ZDpPP0cXyDj.yGanI9GL6IauC6ZrvY5YfeAy8Dkg1Kl3xRMTM0AMAbGlXayAZWX.FR7C6VWDJHKd0ABIu6IDFVe1FSP6Tyzr4Uyp7pTnFWunvFm04PpeKBVo_AeprparouzVP9B8kfHg5B11hOZGqwdUILUaUl9Dvdg_0KOJg0zH2OV4SAEhZQhWn5zhv1gAtotcicJCMRXukeL.y.XA3O0.n1ZHV2c7OW4Ga49UxyA69oHvHCFyU.egFiYc0QS13Trf0gvRmUu4', domain: '.technoproperty.in', path: '/', secure: true },
  { name: '_ga_1DEN42JG14', value: 'GS2.1.s1789460051$o3$g1$t1789461854$j60$l0$h0', domain: '.technoproperty.in', path: '/', secure: true },
];

const context = await Camoufox({ headless: false, user_data_dir: PROFILE_DIR });
const page = await context.newPage();
await context.addCookies(COOKIES);

try {
  await page.goto('https://ahmedabad.technoproperty.in/ResidentialRent.php', { waitUntil: 'domcontentloaded', timeout: 100000 });
} catch (e) { console.log('nav warning'); }

for (let i = 0; i < 30; i++) {
  await page.waitForTimeout(1200);
  const ok = await page.evaluate(() => {
    try { return $('#tblpropertylisting').DataTable().page.info().recordsTotal > 0; } catch { return false; }
  });
  if (ok) break;
}

// capture all POST/fetch endpoints of interest, then click the Contact Details button
page.on('response', async res => {
  if (res.request().method() === 'POST' && res.url().includes('technoproperty.in')) {
    try {
      const t = await res.text();
      console.log(`POST ${res.url()}  size=${t.length}  body=${t.slice(0, 400).replace(/\n/g, ' ')}`);
    } catch {}
  }
});

const btnInfo = await page.evaluate(() => {
  const b = document.querySelector('#tblpropertylisting tbody .dt-contact-btn');
  if (!b) return null;
  return { id: b.id, propid: b.dataset.propid, html: b.outerHTML.slice(0, 300) };
});
console.log('\ncontact button:', JSON.stringify(btnInfo, null, 2));

if (btnInfo) {
  console.log('\nclicking contact button...');
  await page.evaluate(() => document.querySelector('#tblpropertylisting tbody .dt-contact-btn').click());
  await page.waitForTimeout(4000);

  const after = await page.evaluate(() => {
    const b = document.querySelector('#tblpropertylisting tbody .dt-contact-btn');
    const row = b?.closest('tr');
    return {
      btnAfter: b?.outerHTML.slice(0, 500),
      rowText: row?.textContent.replace(/\s+/g, ' ').trim().slice(0, 400),
      nameCell: b?.closest('td')?.textContent.replace(/\s+/g, ' ').trim().slice(0, 300),
    };
  });
  console.log('\nafter click:', JSON.stringify(after, null, 2));
}

await context.close();