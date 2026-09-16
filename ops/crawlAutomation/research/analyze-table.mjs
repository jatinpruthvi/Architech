import { readFileSync } from 'node:fs';

const html = readFileSync('tp-ResidentialRent.html', 'utf8');

// Extract the table content
const tableStart = html.indexOf('<table id="tblpropertylisting"');
const tableEnd = html.indexOf('</table>', tableStart);
const table = html.slice(tableStart, tableEnd + 8);

console.log('=== table length:', table.length);
console.log('=== first 3000 chars of table ===');
console.log(table.slice(0, 3000));

console.log('\n\n=== rows count ===');
const rows = table.match(/<tr/g) || [];
console.log('  <tr count:', rows.length);

console.log('\n=== data rows sample ===');
// find tbody
const tbodyStart = table.indexOf('<tbody');
if (tbodyStart === -1) {
  console.log('  NO tbody found — data may load via AJAX/DataTables');
}