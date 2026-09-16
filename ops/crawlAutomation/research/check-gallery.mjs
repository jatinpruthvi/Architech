import { readFileSync } from 'node:fs';

const rows = JSON.parse(readFileSync('tp-dt-rows.json', 'utf8'));
console.log('rows in file:', rows.length);

let galleryRows = 0;
let rowsWithContactBtn = 0;
let rowsWithContactShown = 0;
const seen = {};

for (const r of rows) {
  const joined = (r[4] || '') + '|' + (r[0] || '');
  const c4 = r[4] || '';
  const c0 = r[0] || '';
  if (/image-gallery|\.jpg|\.png|src=/i.test(JSON.stringify(r))) galleryRows++;
  if (c4.includes('dt-contact-btn')) rowsWithContactBtn++;
  if (/<br>\d{10}/.test(c4)) rowsWithContactShown++;

  // check any 'img' or 'gallery' in ALL cells
  for (let i = 0; i < r.length; i++) {
    if (typeof r[i] === 'string' && /image-gallery|<img|\.(jpg|jpeg|png|webp)/i.test(r[i])) {
      seen[i] = true;
    }
  }
}

console.log('rows with gallery/img in any cell:', galleryRows);
console.log('rows with contact button (col4):', rowsWithContactBtn);
console.log('rows with phone shown (col4):', rowsWithContactShown);
console.log('columns containing img/gallery refs:', Object.keys(seen).map(Number));

// cell 19 may have more metadata — check for image fields
const r0 = rows[0];
console.log('\n=== col19 full ===');
console.log(r0[19]);