import { readFileSync } from 'node:fs';

const js = readFileSync('common.min.js', 'utf8');
const i = js.indexOf('function triggerImageGallery');
console.log(js.slice(i, i + 4500).replace(/\n/g, ' '));