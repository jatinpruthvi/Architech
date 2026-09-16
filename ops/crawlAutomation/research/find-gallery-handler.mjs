import { readFileSync } from 'node:fs';

const js = readFileSync('datatable-listing.min.js', 'utf8');

// find the click handler for .js-image-gallery
const idx = js.indexOf('.js-image-gallery');
console.log('first ref @', idx);
console.log(js.slice(Math.max(0, idx - 200), idx + 1500).replace(/\n/g, ' '));
console.log('\n\n===== all refs =====');
for (const m of js.matchAll(/js-image-gallery/g)) {
  console.log('@', m.index);
}