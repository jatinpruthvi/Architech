import Database from 'better-sqlite3';
const db = new Database('E:/Jatin-Project/Broker/BrainStrom/automation/technoproperty/data/technoproperty.db');

const inactive = db.prepare('SELECT property_id, crawl_id, listed_at, last_seen_at, active, row_hash FROM property_listings WHERE category_key=? AND active=0').all('Important');
console.log('INACTIVE Important listings:', JSON.stringify(inactive, null, 1));

for (const l of inactive) {
  const p = db.prepare('SELECT property_id, active, first_seen_at, last_seen_at, categories FROM properties WHERE property_id=?').get(l.property_id);
  console.log('\nPROPERTY for', l.property_id.slice(0, 12) + ':', JSON.stringify(p));
  const activeRow = db.prepare('SELECT crawl_id, listed_at, last_seen_at, active FROM property_listings WHERE property_id=? AND active=1').all(l.property_id);
  console.log('other ACTIVE listings for this prop:', JSON.stringify(activeRow));
}
db.close();