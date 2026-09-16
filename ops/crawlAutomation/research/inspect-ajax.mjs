import { readFileSync } from 'node:fs';

const j = JSON.parse(readFileSync('tp-browser-ajax.json', 'utf8'));

console.log('=== top-level keys:', Object.keys(j).join(', '));
console.log('recordsTotal:', j.recordsTotal, '| recordsFiltered:', j.recordsFiltered);
console.log('data type:', Array.isArray(j.data) ? 'array' : typeof j.data, '| length:', j.data?.length);

if (Array.isArray(j.data) && j.data.length) {
  console.log('\n=== first record keys ===');
  const rec = j.data[0];
  for (const [k, v] of Object.entries(rec)) {
    let s = typeof v === 'string' ? v : JSON.stringify(v);
    console.log(`  ${k}: ${s.slice(0, 200)}`);
  }
}

writeFileSync('tp-ajax-preview.json', JSON.stringify({
  total: j.recordsTotal,
  filtered: j.recordsFiltered,
  draw: j.draw,
  sample: j.data?.slice(0, 2),
}, null, 2));
console.log('\npreview saved');