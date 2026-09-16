import { readFileSync } from 'node:fs';

const js = readFileSync('datatable-listing.min.js', 'utf8');

function around(idx, before = 400, after = 700) {
  const s = Math.max(0, idx - before);
  return js.slice(s, idx + after);
}

for (const key of ['dtSidePanel', 'dtSideBtn', 'data-side', 'gallery', 'window.open', 'sidepanel']) {
  const idx = js.indexOf(key);
  console.log(`\n\n========== "${key}" @${idx} ==========`);
  if (idx !== -1) console.log(around(idx));
  else console.log('not found');
}