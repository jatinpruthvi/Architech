import Database from 'better-sqlite3';
const db = new Database('E:/Jatin-Project/Broker/BrainStrom/automation/technoproperty/data/technoproperty.db');

const cl = db.prepare('SELECT id,mode,status,total_properties,new_properties,updated_properties,removed_properties,errors FROM crawls ORDER BY id DESC LIMIT 1').get();
console.log('LAST CRAWL:', JSON.stringify(cl));

const r = db.prepare('SELECT property_id,first_seen_at,last_seen_at,last_modified_at FROM properties WHERE property_id=?').get('8d26ddf5-30d2-cdda-5f09-6a30e261a2e3');
console.log('SAMPLE PROP AFTER:', JSON.stringify(r));

const imp = db.prepare('SELECT COUNT(*) AS c, COUNT(DISTINCT property_id) AS d FROM property_listings WHERE category_key=?').get('Important');
console.log('Important listings rows/distinct:', JSON.stringify(imp));

const impact = db.prepare('SELECT COUNT(*) AS c FROM property_listings WHERE category_key=? AND active=1').get('Important');
console.log('Important active listings:', JSON.stringify(impact));

const mixed = db.prepare('SELECT property_id, COUNT(*) AS c FROM property_listings GROUP BY property_id HAVING c>1 LIMIT 5').all();
console.log('Props in multiple categories:', JSON.stringify(mixed));

const ch = db.prepare('SELECT COUNT(*) AS c FROM changes').get();
console.log('changes table total:', JSON.stringify(ch));

const plc = db.prepare('SELECT crawl_id, category_key, COUNT(*) AS c FROM property_listings GROUP BY crawl_id, category_key ORDER BY crawl_id DESC LIMIT 6').all();
console.log('listings per crawl:', JSON.stringify(plc));

const props = db.prepare('SELECT COUNT(*) AS c FROM properties WHERE active=1').get();
console.log('active properties:', JSON.stringify(props));
db.close();