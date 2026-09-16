import { readFileSync } from 'node:fs';

const js = readFileSync('datatable-listing.min.js', 'utf8');

function around(key, before = 500, after = 900) {
  const idxs = [...js.matchAll(new RegExp(key, 'g'))].map(m => m.index);
  const out = [];
  for (const idx of idxs.slice(0, 4)) {
    const s = Math.max(0, idx - before);
    out.push(js.slice(s, idx + after));
  }
  return out.join('\n----\n');
}

for (const key of ['data-side-action="gallery"', 'js-image-gallery', 'gallery', 'dskimg', 'propertyimages', 'images/']) {
  console.log(`\n\n========== "${key}" ==========`);
  console.log(around(key).slice(0, 3500));
}