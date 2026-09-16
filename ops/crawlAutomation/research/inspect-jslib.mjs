import { readFileSync } from 'node:fs';

const js = readFileSync('datatable-listing.min.js', 'utf8');
const endpoints = [...new Set(js.match(/["']([\w\/]+\.php)["'][^)]{0,80}/g) || [])].slice(0, 60);
console.log('=== .php references ===');
endpoints.forEach(e => console.log(' ', e));

const words = [...new Set(js.match(/\b(?:getcntinfo|propid|photo|detail|premise|whatsapp|share|maps|slideshow|gallery|sideview|viewproperty|propertydetails|download|premium|important|link|encodeURIComponent|data-\w+)\w*/g) || [])];
console.log('\n=== interesting identifiers ===');
words.forEach(w => console.log(' ', w));

console.log('\n=== how the detail/view works: search for window.open or href build ===');
const openies = js.match(/.{80}(?:window\.open|location\.href|\.attr\(['"]href|url:\s*['"]).{120}/gs);
if (openies) openies.forEach(o => console.log('--\n', o.replace(/\s+/g, ' ').slice(0, 400)));