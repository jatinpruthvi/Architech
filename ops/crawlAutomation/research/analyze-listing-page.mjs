import { readFileSync } from 'node:fs';

const html = readFileSync('tp-ResidentialRent.html', 'utf8');

console.log('=== Property detail links ===');
const detailLinks = [...new Set(html.match(/href="([^"]*(?:property|detail|prop)[^"]*)"/gi) || [])];
detailLinks.slice(0, 30).forEach(l => console.log('  ', l));

console.log('\n=== All hrefs (first 60) ===');
const hrefs = [...new Set(html.match(/href="([^"]+)"/g) || [])].slice(0, 60);
hrefs.forEach(h => console.log('  ', h.replace('href=', '')));

console.log('\n=== table structure ===');
if (html.includes('<table')) {
  const tables = html.match(/<table[^>]*>/g) || [];
  console.log('  tables:', tables.length);
  tables.forEach(t => console.log('  ', t));
}

console.log('\n=== forms ===');
const forms = [...html.matchAll(/<form[^>]*action="([^"]*)"[^>]*>/g)];
forms.forEach(f => console.log('  action:', f[1]));

console.log('\n=== pagination ===');
const pag = [...new Set(html.match(/(?:page|Page|pgno|limit|offset)[^"'\s<>]{0,30}(?:=|&)[^"'\s<>]{0,30}/g) || [])];
pag.slice(0, 20).forEach(p => console.log('  ', p));

console.log('\n=== property cards / rows ===');
// look for common listing patterns
const patterns = ['property-card', 'propertyCard', 'prop-list', 'propList', 'listing', 'srp', 'bldg_name', 'property_name', 'prop_name', 'propertyid', 'prop_id', 'property_id'];
for (const p of patterns) {
  const count = (html.match(new RegExp(p, 'gi')) || []).length;
  console.log(`  ${p}: ${count} occurrences`);
}

console.log('\n=== visible text sample ===');
const text = html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
console.log(text.slice(0, 2000));