import { readFileSync } from 'node:fs';

const js = readFileSync('common.min.js', 'utf8');

// Look at the js-image-gallery handler around 18280
console.log('===== around 18280 =====');
console.log(js.slice(17500, 19250).replace(/\n/g, ' '));

// And the gallery area around 30497
console.log('\n\n===== around 30497 =====');
console.log(js.slice(29500, 31200).replace(/\n/g, ' '));