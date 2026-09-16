import { readFileSync } from 'node:fs';

const html = readFileSync('tp-ResidentialRent.html', 'utf8');
const idx = html.indexOf('js-image-gallery');
if (idx !== -1) {
  console.log('page HTML js-image-gallery @', idx);
  console.log(html.slice(Math.max(0, idx - 300), idx + 400));
} else {
  console.log('js-image-gallery NOT in page HTML');
}
// gallery modal/template search
for (const kw of ['dskimage', 'galimg', 'lightbox', 'photoGallery', 'imagegallery', 'imggallery', 'propimg', 'lightgallery']) {
  const i = html.indexOf(kw);
  console.log(kw, '@', i, i !== -1 ? 'HIT' : '');
}