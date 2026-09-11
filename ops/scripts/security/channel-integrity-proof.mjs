/* Broker-channel integrity proof against a REAL PostgreSQL.
 *
 * The channel's safety rests on database constraints, not on application code:
 * a DEMAND request must carry a budget and never a price, a SUPPLY request
 * must carry a price and never a budget, a listing may back at most one
 * channel source record, a deal may not involve an organization with itself,
 * commission splits must balance to the paisa, and Row Level Security must
 * allow cross-agency DISCOVERY of open requests while still forbidding
 * cross-agency WRITES. Each of those is asserted here as a real non-superuser,
 * because a superuser bypasses RLS unconditionally and would make every policy
 * look like it works.
 *
 * It creates roles and drops the public schema, so it is NOT part of
 * `pnpm test`. Run it against a scratch PostgreSQL before shipping a change to
 * the channel migration:
 *
 *   DATABASE_URL=postgresql://postgres@localhost:5432/scratch \
 *     node scripts/security/channel-integrity-proof.mjs
 *
 * Targets the canonical channel migration 202609040001_broker_channel (the
 * superseded listing-anchored draft was removed before any deploy applied it).
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
/* Role-agnostic on purpose: the connecting user owns the fresh schema, so no
   superuser name ("postgres" vs sandbox roles) is hardcoded here. */
await admin.query(`GRANT USAGE ON SCHEMA public TO PUBLIC;`);

// Minimal ancestor tables matching real shapes. ChannelRequestSource holds FKs
// into Listing and Requirement, and the channel migration also builds an index
// on Requirement(organizationId, status, createdAt), so those columns must exist.
await admin.query(`
  CREATE TABLE "BrokerOrganization"("id" TEXT PRIMARY KEY,"name" TEXT);
  CREATE TABLE "City"("id" TEXT PRIMARY KEY,"slug" TEXT);
  CREATE TABLE "Locality"("id" TEXT PRIMARY KEY,"slug" TEXT);
  CREATE TABLE "Listing"("id" TEXT PRIMARY KEY,"brokerOrgId" TEXT,"lifecycle" TEXT);
  CREATE TABLE "Requirement"("id" TEXT PRIMARY KEY,"organizationId" TEXT,"status" TEXT,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
  CREATE TABLE "Lead"("id" TEXT PRIMARY KEY,"organizationId" TEXT);
  CREATE TABLE "BrokerUser"("id" TEXT PRIMARY KEY,"organizationId" TEXT NOT NULL);
  CREATE TABLE "AuditEvent"("id" TEXT PRIMARY KEY,"organizationId" TEXT,"action" TEXT);
  CREATE TABLE "InteropOutbox"("id" TEXT PRIMARY KEY,"organizationId" TEXT NOT NULL);
  CREATE TABLE "InteropInboundEvent"("id" TEXT PRIMARY KEY,"organizationId" TEXT);
`);
await admin.query(readFileSync(`${R}/202609030004_row_level_security/migration.sql`, "utf8"));
await admin.query(readFileSync(`${R}/202609040001_broker_channel/migration.sql`, "utf8"));
check("channel migration applies to PostgreSQL 17", true);

await admin.query(`
  INSERT INTO "BrokerOrganization" VALUES ('org_a','A'),('org_b','B');
  INSERT INTO "City" VALUES ('city_1','ahmedabad');
  INSERT INTO "Listing" VALUES ('list_a','org_a','ACTIVE'),('list_b','org_b','ACTIVE');
`);

const ins = (id, org, type, extra = {}) => {
  const cols = { id, organizationId: org, createdById: `u_${org}`, type, intent: "BUY", cityId: "city_1",
    propertyType: "APARTMENT", detailSummary: "2nd floor, lift", expiresAt: "2026-12-01", status: "OPEN", ...extra };
  const keys = Object.keys(cols);
  return [`INSERT INTO "ChannelRequest"(${keys.map(k => `"${k}"`).join(",")}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(",")})`,
    Object.values(cols)];
};

// --- demand/supply shape --------------------------------------------------
check("DEMAND without a budget range is rejected",
  await rejects(admin, ...ins("r1", "org_b", "DEMAND")));
check("DEMAND carrying a price is rejected",
  await rejects(admin, ...ins("r2", "org_b", "DEMAND", { budgetMinInr: 8000000, budgetMaxInr: 12000000, priceInr: 9500000 })));
check("DEMAND with a budget range is accepted",
  !(await rejects(admin, ...ins("r3", "org_b", "DEMAND", { budgetMinInr: 8000000, budgetMaxInr: 12000000 }))));
check("SUPPLY without a price is rejected",
  await rejects(admin, ...ins("r4", "org_a", "SUPPLY")));
check("SUPPLY carrying a budget range is rejected",
  await rejects(admin, ...ins("r5", "org_a", "SUPPLY", { priceInr: 9500000, budgetMaxInr: 1 })));
check("SUPPLY with a price is accepted",
  !(await rejects(admin, ...ins("r6", "org_a", "SUPPLY", { priceInr: 9500000 }))));

// --- ordered ranges ---------------------------------------------------------
check("inverted budget range is rejected",
  await rejects(admin, ...ins("r7", "org_b", "DEMAND", { budgetMinInr: 9, budgetMaxInr: 1 })));
check("inverted BHK range is rejected",
  await rejects(admin, ...ins("r8", "org_b", "DEMAND", { budgetMinInr: 1, budgetMaxInr: 9, bhkMin: 5, bhkMax: 2 })));

// --- private source anchor ---------------------------------------------------
const insSource = (id, requestId, org, listingId) => [
  `INSERT INTO "ChannelRequestSource"("id","channelRequestId","organizationId","sourceListingId") VALUES ($1,$2,$3,$4)`,
  [id, requestId, org, listingId]];
check("a source row may point at a real listing",
  !(await rejects(admin, ...insSource("s1", "r6", "org_a", "list_a"))));
check("a source row pointing at a missing listing is rejected",
  await rejects(admin, ...insSource("s2", "r6", "org_a", "list_missing")));
check("a second source row for the same listing is rejected",
  await rejects(admin, ...insSource("s3", "r4", "org_a", "list_a")));

// --- matches -----------------------------------------------------------------
const insMatch = (id, d, s, score = 90) => [
  `INSERT INTO "ChannelMatch"("id","demandRequestId","supplyRequestId","score","reasons") VALUES ($1,$2,$3,$4,'[]')`,
  [id, d, s, score]];
check("a valid cross-agency match is accepted",
  !(await rejects(admin, ...insMatch("m1", "r3", "r6"))));
check("a match pairing a request with itself is rejected",
  await rejects(admin, ...insMatch("m2", "r3", "r3")));
check("a score above 100 is rejected",
  await rejects(admin, ...insMatch("m3", "r3", "r6", 101)));
check("a duplicate pairing is rejected",
  await rejects(admin, ...insMatch("m4", "r3", "r6")));

// --- deals -------------------------------------------------------------------
const insDeal = (id, matchId, dOrg, sOrg, extra = {}) => {
  const cols = { id, matchId, demandOrganizationId: dOrg, supplyOrganizationId: sOrg, ...extra };
  const keys = Object.keys(cols);
  return [`INSERT INTO "ChannelDeal"(${keys.map(k => `"${k}"`).join(",")}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(",")})`,
    Object.values(cols)];
};
check("a deal between an organization and itself is rejected",
  await rejects(admin, ...insDeal("d1", "m1", "org_a", "org_a")));
check("an unbalanced commission split is rejected",
  await rejects(admin, ...insDeal("d2", "m1", "org_b", "org_a", { totalCommissionInr: 100, demandBrokerShareInr: 40, supplyBrokerShareInr: 40 })));
check("a balanced commission split is accepted",
  !(await rejects(admin, ...insDeal("d3", "m1", "org_b", "org_a", { totalCommissionInr: 100, demandBrokerShareInr: 40, supplyBrokerShareInr: 60 }))));
check("a second deal on the same match is rejected",
  await rejects(admin, ...insDeal("d4", "m1", "org_b", "org_a")));

// --- sanitized projection ------------------------------------------------------
const viewCols = await admin.query(`SELECT column_name FROM information_schema.columns WHERE table_name='ChannelRequestSanitized'`);
check("the sanitized projection exposes no private source anchor or broker note",
  !viewCols.rows.some((r) => ["createdById", "brokerNote", "sourceListingId", "sourceRequirementId"].includes(r.column_name)),
  `cols=${viewCols.rows.length}`);

// --- RLS as a real non-superuser -------------------------------------------
await admin.query(`DROP ROLE IF EXISTS app_role`);
await admin.query(`CREATE ROLE app_role LOGIN PASSWORD 'p' NOSUPERUSER NOBYPASSRLS`);
await admin.query(`GRANT USAGE ON SCHEMA public TO app_role`);
await admin.query(`GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO app_role`);

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

await admin.query(...ins("rd", "org_b", "DEMAND", { budgetMinInr: 1, budgetMaxInr: 2, status: "DRAFT" }));
const draft = await app.query(`SELECT count(*)::int n FROM "ChannelRequest" WHERE id='rd'`);
check("another agency's DRAFT stays hidden", draft.rows[0].n === 0, `saw ${draft.rows[0].n}`);

check("cannot publish a request as another agency",
  await rejects(app, ...ins("rx", "org_b", "DEMAND", { budgetMinInr: 1, budgetMaxInr: 2 })));

const upd = await app.query(`UPDATE "ChannelRequest" SET "brokerNote"='hacked' WHERE "organizationId"='org_b'`);
check("cannot edit another agency's request", upd.rowCount === 0, `rowCount=${upd.rowCount}`);

const mine = await app.query(`SELECT count(*)::int n FROM "ChannelMatch"`);
check("a participant sees its own match", mine.rows[0].n === 1, `saw ${mine.rows[0].n}`);

await setOrg("org_c");
const outsider = await app.query(`SELECT count(*)::int n FROM "ChannelMatch"`);
check("a non-participant sees no matches", outsider.rows[0].n === 0, `saw ${outsider.rows[0].n}`);

check("a non-participant cannot write a match for others' requests",
  await rejects(app, ...insMatch("m_evil", "r3", "r6")));

await app.query(`SELECT set_config('app.current_org_id','',false)`);
const anon = await app.query(`SELECT count(*)::int n FROM "ChannelRequest"`);
check("an unscoped connection sees no requests (fail-closed)", anon.rows[0].n === 0, `saw ${anon.rows[0].n}`);

await app.end();
await admin.end();
const bad = out.filter((r) => !r.p);
console.log(`\n${out.length - bad.length}/${out.length} checks passed`);
if (bad.length) process.exit(1);
