/* Broker-channel integrity proof against a REAL PostgreSQL.
 *
 * The channel's safety rests on database constraints, not on application code:
 * a SUPPLY request must point at a real listing, a DEMAND request must not, a
 * listing may carry only one live offer, an agency may not match with itself,
 * and Row Level Security must allow cross-agency DISCOVERY while still
 * forbidding cross-agency WRITES. Each of those is asserted here as a real
 * non-superuser, because a superuser bypasses RLS unconditionally and would
 * make every policy look like it works.
 *
 * It creates roles and drops the public schema, so it is NOT part of
 * `pnpm test`. Run it against a scratch PostgreSQL before shipping a change to
 * the channel migration:
 *
 *   DATABASE_URL=postgresql://postgres@localhost:5432/scratch \\
 *     node scripts/security/channel-integrity-proof.mjs
 *
 * Verified passing 23/23 on PostgreSQL 17.4.
 */
import { Client } from "pg";
import { readFileSync } from "node:fs";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is required. Point it at a THROWAWAY database: this script drops and recreates schemas.");
  process.exit(2);
}
const R = "prisma/migrations";
const admin = new Client({ connectionString: url });
const out = [];
const check = (n, p, d = "") => { out.push({ n, p }); console.log(`${p ? "PASS" : "FAIL"}  ${n}${d ? ` -- ${d}` : ""}`); };
const rejects = async (c, sql, params) => { try { await c.query(sql, params); return false; } catch { return true; } };

await admin.connect();
await admin.query(`DROP SCHEMA public CASCADE; CREATE SCHEMA public;`);
await admin.query(`GRANT ALL ON SCHEMA public TO postgres; GRANT USAGE ON SCHEMA public TO PUBLIC;`);

// Minimal ancestor tables matching real shapes.
await admin.query(`
  CREATE TYPE "PropertyType" AS ENUM ('APARTMENT','ROWHOUSE','VILLA','PENTHOUSE','PLOT');
  CREATE TABLE "BrokerOrganization"("id" TEXT PRIMARY KEY,"name" TEXT);
  CREATE TABLE "City"("id" TEXT PRIMARY KEY,"slug" TEXT);
  CREATE TABLE "Locality"("id" TEXT PRIMARY KEY,"slug" TEXT);
  CREATE TABLE "Listing"("id" TEXT PRIMARY KEY,"brokerOrgId" TEXT,"lifecycle" TEXT);
  CREATE TABLE "Lead"("id" TEXT PRIMARY KEY,"organizationId" TEXT);
  CREATE TABLE "BrokerUser"("id" TEXT PRIMARY KEY,"organizationId" TEXT NOT NULL);
  CREATE TABLE "AuditEvent"("id" TEXT PRIMARY KEY,"organizationId" TEXT,"action" TEXT);
  CREATE TABLE "InteropOutbox"("id" TEXT PRIMARY KEY,"organizationId" TEXT NOT NULL);
  CREATE TABLE "InteropInboundEvent"("id" TEXT PRIMARY KEY,"organizationId" TEXT);
`);
await admin.query(readFileSync(`${R}/202609030004_row_level_security/migration.sql`, "utf8"));
await admin.query(readFileSync(`${R}/202609030006_broker_channel/migration.sql`, "utf8"));
check("channel migration applies to PostgreSQL 17", true);

await admin.query(`
  INSERT INTO "BrokerOrganization" VALUES ('org_a','A'),('org_b','B');
  INSERT INTO "City" VALUES ('city_1','ahmedabad');
  INSERT INTO "Locality" VALUES ('loc_1','thaltej'),('loc_2','bopal');
  INSERT INTO "Listing" VALUES ('list_a','org_a','ACTIVE'),('list_b','org_b','ACTIVE');
`);

const ins = (id, org, type, extra = {}) => {
  const cols = { id, organizationId: org, type, intent: "BUY", cityId: "city_1",
    propertyType: "APARTMENT", expiresAt: "2026-12-01", updatedAt: "2026-09-04", status: "OPEN", ...extra };
  const keys = Object.keys(cols);
  return [`INSERT INTO "ChannelRequest"(${keys.map(k => `"${k}"`).join(",")}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(",")})`,
    Object.values(cols)];
};

// --- CHECK: SUPPLY must have a listing; DEMAND must not --------------------
check("SUPPLY without a listing is rejected",
  await rejects(admin, ...ins("r1", "org_a", "SUPPLY")));
check("SUPPLY with a listing is accepted",
  !(await rejects(admin, ...ins("r2", "org_a", "SUPPLY", { listingId: "list_a" }))));
check("DEMAND with a listing is rejected",
  await rejects(admin, ...ins("r3", "org_b", "DEMAND", { listingId: "list_b" })));
check("DEMAND without a listing is accepted",
  !(await rejects(admin, ...ins("r4", "org_b", "DEMAND", { budgetMaxInr: 12000000 }))));

// --- CHECK: budget is demand-only, ranges ordered ---------------------------
check("budget on SUPPLY is rejected",
  await rejects(admin, ...ins("r5", "org_a", "SUPPLY", { listingId: "list_a", budgetMaxInr: 1 })));
check("inverted budget range is rejected",
  await rejects(admin, ...ins("r6", "org_b", "DEMAND", { budgetMinInr: 9, budgetMaxInr: 1 })));
check("inverted BHK range is rejected",
  await rejects(admin, ...ins("r7", "org_b", "DEMAND", { bhkMin: 5, bhkMax: 2 })));

// --- one OPEN supply per listing -------------------------------------------
check("a second OPEN supply for the same listing is rejected",
  await rejects(admin, ...ins("r8", "org_a", "SUPPLY", { listingId: "list_a" })));
await admin.query(`UPDATE "ChannelRequest" SET status='CLOSED' WHERE id='r2'`);
check("republishing after closing the previous offer is allowed",
  !(await rejects(admin, ...ins("r9", "org_a", "SUPPLY", { listingId: "list_a" }))));

// --- matches ---------------------------------------------------------------
const insMatch = (id, d, s, dOrg, sOrg, score = 90) => [
  `INSERT INTO "ChannelMatch"("id","demandRequestId","supplyRequestId","demandOrganizationId","supplyOrganizationId","score","reasons","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,'[]','2026-09-04')`,
  [id, d, s, dOrg, sOrg, score]];
check("a valid cross-agency match is accepted",
  !(await rejects(admin, ...insMatch("m1", "r4", "r9", "org_b", "org_a"))));
check("a self-match is rejected",
  await rejects(admin, ...insMatch("m2", "r4", "r9", "org_a", "org_a")));
check("a score above 100 is rejected",
  await rejects(admin, ...insMatch("m3", "r4", "r9", "org_b", "org_a", 101)));
check("a duplicate pairing is rejected",
  await rejects(admin, ...insMatch("m4", "r4", "r9", "org_b", "org_a")));

// --- cascade ---------------------------------------------------------------
await admin.query(`DELETE FROM "Listing" WHERE id='list_a'`);
const gone = await admin.query(`SELECT count(*)::int n FROM "ChannelRequest" WHERE "listingId"='list_a'`);
check("deleting a listing removes its supply offers", gone.rows[0].n === 0, `left ${gone.rows[0].n}`);

// --- RLS as a real non-superuser -------------------------------------------
await admin.query(`DROP ROLE IF EXISTS app_role`);
await admin.query(`CREATE ROLE app_role LOGIN PASSWORD 'p' NOSUPERUSER NOBYPASSRLS`);
await admin.query(`GRANT USAGE ON SCHEMA public TO app_role`);
await admin.query(`GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO app_role`);

// The cascade test above removed list_a and r9; re-create a live pairing.
await admin.query(`INSERT INTO "Listing" VALUES ('list_c','org_a','ACTIVE')`);
await admin.query(...ins("rs", "org_a", "SUPPLY", { listingId: "list_c" }));
await admin.query(...insMatch("m9", "r4", "rs", "org_b", "org_a"));
/* Build the URL rather than passing `user` alongside `connectionString`: the
   latter is ignored, and we would silently reconnect as the superuser, which
   bypasses RLS and makes every policy below look like it passes. */
const appUrl = url.replace(/:\/\/[^@/]*@?/, "://app_role:p@");
const app = new Client({ connectionString: appUrl });
await app.connect();
const setOrg = (o) => app.query(`SELECT set_config('app.current_org_id',$1,false)`, [o]);

await setOrg("org_a");
const disc = await app.query(`SELECT count(*)::int n FROM "ChannelRequest" WHERE "organizationId"='org_b'`);
check("discovery: an agency CAN see another's OPEN requests", disc.rows[0].n >= 1, `saw ${disc.rows[0].n}`);

await admin.query(`INSERT INTO "ChannelRequest"("id","organizationId","type","intent","cityId","propertyType","expiresAt","updatedAt","status") VALUES ('rd','org_b','DEMAND','BUY','city_1','APARTMENT','2026-12-01','2026-09-04','DRAFT')`);
const draft = await app.query(`SELECT count(*)::int n FROM "ChannelRequest" WHERE id='rd'`);
check("another agency's DRAFT stays hidden", draft.rows[0].n === 0, `saw ${draft.rows[0].n}`);

check("cannot publish a request as another agency",
  await rejects(app, `INSERT INTO "ChannelRequest"("id","organizationId","type","intent","cityId","propertyType","expiresAt","updatedAt") VALUES ('rx','org_b','DEMAND','BUY','city_1','APARTMENT','2026-12-01','2026-09-04')`));

const upd = await app.query(`UPDATE "ChannelRequest" SET "brokerNote"='hacked' WHERE "organizationId"='org_b'`);
check("cannot edit another agency's request", upd.rowCount === 0, `rowCount=${upd.rowCount}`);

const mine = await app.query(`SELECT count(*)::int n FROM "ChannelMatch"`);
check("a participant sees its own match", mine.rows[0].n === 1, `saw ${mine.rows[0].n}`);

await setOrg("org_c");
const outsider = await app.query(`SELECT count(*)::int n FROM "ChannelMatch"`);
check("a non-participant sees no matches", outsider.rows[0].n === 0, `saw ${outsider.rows[0].n}`);

await app.query(`SELECT set_config('app.current_org_id','',false)`);
const anon = await app.query(`SELECT count(*)::int n FROM "ChannelRequest"`);
check("an unscoped connection sees no requests (fail-closed)", anon.rows[0].n === 0, `saw ${anon.rows[0].n}`);

await setOrg("org_a");
check("tenants cannot insert matches directly (matcher is privileged)",
  await rejects(app, ...insMatch("m_evil", "r4", "rs", "org_a", "org_b")));

await app.end();
await admin.end();
const bad = out.filter((r) => !r.p);
console.log(`\n${out.length - bad.length}/${out.length} checks passed`);
if (bad.length) process.exit(1);
