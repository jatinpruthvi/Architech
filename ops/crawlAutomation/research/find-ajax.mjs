import { readFileSync } from 'node:fs';

const html = readFileSync('tp-ResidentialRent.html', 'utf8');

// Find all inline scripts
const scripts = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)];
console.log('=== inline script count:', scripts.length);
for (const m of scripts) {
  const src = m[1].trim();
  if (src.includes('ajax') || src.includes('DataTable') || src.includes('datatable') || src.includes('propList') || src.includes('url:')) {
    console.log('\n--- script with AJAX/DataTable ---');
    console.log(m[1].slice(0, 3000));
  }
}

console.log('\n\n=== All .js files loaded ===');
const jsFiles = [...new Set(html.match(/src="([^"]+\.js[^"]*)"/g) || [])];
jsFiles.forEach(j => console.log('  ', j.replace('src=', '')));

console.log('\n=== search for AJAX URLs / php endpoints in ALL scripts ===');
const allJs = html.match(/<script[^>]*>([\s\S]*?)<\/script>/g)?.join('\n') || '';
const ajaxEndpoints = [...new Set(allJs.match(/[\w\/\-]+\.php[^"'\s]*/g) || [])];
ajaxEndpoints.forEach(e => console.log('  ', e));

console.log('\n=== look for "url" assignments ===');
const urlAssigns = [...new Set(allJs.match(/url\s*[:=]\s*["'][^"']+["']/g) || [])];
urlAssigns.forEach(u => console.log('  ', u));