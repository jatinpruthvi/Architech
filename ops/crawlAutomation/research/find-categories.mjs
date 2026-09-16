import { readFileSync } from 'node:fs';

const html = readFileSync('tp-ResidentialRent.html', 'utf8');

// Find all nav/menu links to property listing pages
const links = [...html.matchAll(/href="([^"]*\.php[^"]*)"[^>]*>([^<]{0,60})/g)];
const seen = new Set();
console.log('=== .php links with text ===');
for (const m of links) {
  const href = m[1];
  const text = m[2].replace(/\s+/g, ' ').trim();
  const key = href + '|' + text;
  if (seen.has(key)) continue;
  seen.add(key);
  if (!href.includes('ajax')) console.log(`${href}   =>   ${text}`);
}

// Also look for sidebar menu items specifically
console.log('\n=== sidebar / menu anchors ===');
const menu = [...html.matchAll(/<a[^>]*href="([^"]*)"[^>]*>\s*<i[^>]*>.*?<\/i>?\s*([^<]*)<\/a>/gs)];
for (const m of menu.slice(0, 60)) {
  console.log(`${m[1]}   =>   ${m[2].replace(/\s+/g,' ').trim()}`);
}

// propertytype guids used in the listing request
const guids = [...html.matchAll(/propertytype['":= ]+([0-9a-f-]{36})/gi)];
console.log('\n=== property type GUIDs referenced ===');
for (const g of guids) console.log('  ', g[1]);

// Look for the list of count categories / property types in nav
const cat = [...html.matchAll(/countcategory[^,;]{0,50}/g)];
console.log('\n=== countcategory references ===');
for (const c of cat) console.log('  ', c[0]);