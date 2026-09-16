import { readFileSync } from 'node:fs';

const rows = JSON.parse(readFileSync('tp-dt-rows.json', 'utf8'));
for (const r of rows) {
  if (typeof r[0] === 'string' && /image-gallery|<img|\.(jpg|jpeg|png|webp)/i.test(r[0])) {
    console.log('=== gallery row ===');
    console.log('col4 (contact):', (r[4] || '').slice(0, 200));
    console.log('col0 (action):');
    console.log(r[0]);
    console.log('\n----------------------------------------\n');
    break;
  }
}