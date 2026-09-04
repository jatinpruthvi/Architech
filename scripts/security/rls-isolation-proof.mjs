/* Two-organization RLS isolation proof against a REAL PostgreSQL.
 *
 * The static audit (rls-audit.mjs) checks that the policies SAY the right
 * thing. This proves they DO the right thing, by running the adversarial cases
 * as a genuine non-superuser role: cross-tenant reads and writes, a forgotten
 * WHERE clause, audit tampering, pooled-connection reuse, and an
 * injection-shaped tenant value.
 *
 * It needs a throwaway database and a role it can create, so it is NOT part of
 * `pnpm test`. Run it against a scratch PostgreSQL before shipping a change to
 * the RLS migration:
 *
 *   DATABASE_URL=postgresql://postgres@localhost:5432/scratch \\
 *     node scripts/security/rls-isolation-proof.mjs
 *
 * Verified passing 22/22 on PostgreSQL 17.4.
 */
import { Client } from "pg";
import { readFileSync } from "node:fs";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is required. Point it at a THROWAWAY database: this script drops and recreates tables.");
  process.exit(2);
}
const admin = new Client({ connectionString: url });

const results = [];
const check = (name, pass, detail = "") => {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? ` -- ${detail}` : ""}`);
};

await admin.connect();

// --- Minimal fixture matching the real column shapes -------------------------
await admin.query(`DROP TABLE IF EXISTS "AuditEvent","InteropInboundEvent","InteropOutbox","BrokerUser","Lead" CASCADE`);
await admin.query(`DROP FUNCTION IF EXISTS architech_current_org_id() CASCADE`);
await admin.query(`
  CREATE TABLE "Lead" ("id" TEXT PRIMARY KEY, "organizationId" TEXT, "name" TEXT NOT NULL);
  CREATE TABLE "BrokerUser" ("id" TEXT PRIMARY KEY, "organizationId" TEXT NOT NULL, "userId" TEXT NOT NULL);
  CREATE TABLE "InteropOutbox" ("id" TEXT PRIMARY KEY, "organizationId" TEXT NOT NULL, "idempotencyKey" TEXT UNIQUE NOT NULL);
  CREATE TABLE "InteropInboundEvent" ("id" TEXT PRIMARY KEY, "organizationId" TEXT, "provider" TEXT NOT NULL);
  CREATE TABLE "AuditEvent" ("id" TEXT PRIMARY KEY, "organizationId" TEXT, "action" TEXT NOT NULL);
`);

// Apply the real migration file, minus psql-only bits.
const sql = readFileSync("prisma/migrations/202609030004_row_level_security/migration.sql", "utf8");
await admin.query(sql);
check("migration applies cleanly to PostgreSQL 17", true);

// Seed two competing brokerages + unattributed rows.
await admin.query(`
  INSERT INTO "Lead" VALUES ('l1','org_1','Asha'),('l2','org_2','Bhavin'),('l3',NULL,'Unrouted');
  INSERT INTO "BrokerUser" VALUES ('bu1','org_1','u1'),('bu2','org_2','u2');
  INSERT INTO "InteropOutbox" VALUES ('o1','org_1','k1'),('o2','org_2','k2');
  INSERT INTO "InteropInboundEvent" VALUES ('e1','org_1','frappe'),('e2',NULL,'evolution');
  INSERT INTO "AuditEvent" VALUES ('a1','org_1','lead.created'),('a2','org_2','lead.created');
`);

// Non-superuser application role -- the realistic case.
await admin.query(`DROP OWNED BY architech_app`).catch(() => {});
await admin.query(`DROP ROLE IF EXISTS architech_app`);
await admin.query(`CREATE ROLE architech_app LOGIN PASSWORD 'app' NOSUPERUSER NOBYPASSRLS`);
await admin.query(`GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO architech_app`);
await admin.query(`GRANT USAGE ON SCHEMA public TO architech_app`);

const appUrl = new URL(url);
appUrl.username = "architech_app";
appUrl.password = "app";
const app = new Client({ connectionString: appUrl.toString() });
await app.connect();

const su = await app.query(`SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user`);
check("app role is NOT superuser and NOT BYPASSRLS",
  su.rows[0].rolsuper === false && su.rows[0].rolbypassrls === false,
  `rolsuper=${su.rows[0].rolsuper} rolbypassrls=${su.rows[0].rolbypassrls}`);

const setOrg = (id) => app.query(`SELECT set_config('app.current_org_id', $1, false)`, [id]);

// --- 1. Unset tenant must see NOTHING (fail closed) --------------------------
await app.query(`SELECT set_config('app.current_org_id','',false)`);
for (const t of ["Lead", "BrokerUser", "InteropOutbox", "InteropInboundEvent", "AuditEvent"]) {
  const r = await app.query(`SELECT count(*)::int AS n FROM "${t}"`);
  check(`unset tenant reads 0 rows from ${t} (fail-closed)`, r.rows[0].n === 0, `saw ${r.rows[0].n}`);
}

// --- 2. Tenant sees only its own ---------------------------------------------
await setOrg("org_1");
const l1 = await app.query(`SELECT id FROM "Lead" ORDER BY id`);
check("org_1 sees exactly its own lead", l1.rows.length === 1 && l1.rows[0].id === "l1",
  JSON.stringify(l1.rows.map(r => r.id)));

const unrouted = await app.query(`SELECT id FROM "Lead" WHERE "organizationId" IS NULL`);
check("unrouted (NULL org) lead is invisible to a tenant", unrouted.rows.length === 0);

// --- 3. The attack: explicitly query the OTHER tenant ------------------------
const cross = await app.query(`SELECT id FROM "Lead" WHERE "organizationId" = 'org_2'`);
check("explicit cross-tenant WHERE returns 0 rows", cross.rows.length === 0);

// --- 4. Forgotten WHERE clause -- the real-world bug -------------------------
const forgot = await app.query(`SELECT count(*)::int AS n FROM "Lead"`);
check("query with NO tenant filter still leaks nothing", forgot.rows[0].n === 1, `saw ${forgot.rows[0].n}`);

// --- 5. Writes cannot be attributed to another tenant ------------------------
let blocked = false;
try { await app.query(`INSERT INTO "Lead" VALUES ('x1','org_2','Stolen')`); }
catch { blocked = true; }
check("INSERT into another tenant is rejected by WITH CHECK", blocked);

const upd = await app.query(`UPDATE "Lead" SET name='Hacked' WHERE "organizationId"='org_2'`);
check("UPDATE against another tenant affects 0 rows", upd.rowCount === 0, `rowCount=${upd.rowCount}`);

const del = await app.query(`DELETE FROM "Lead" WHERE "organizationId"='org_2'`);
check("DELETE against another tenant affects 0 rows", del.rowCount === 0, `rowCount=${del.rowCount}`);

// --- 6. Audit trail is append-only to tenants --------------------------------
const audUpd = await app.query(`UPDATE "AuditEvent" SET action='tampered' WHERE "organizationId"='org_1'`);
check("tenant cannot UPDATE its own audit rows (no policy = deny)", audUpd.rowCount === 0, `rowCount=${audUpd.rowCount}`);
const audDel = await app.query(`DELETE FROM "AuditEvent" WHERE "organizationId"='org_1'`);
check("tenant cannot DELETE its own audit rows", audDel.rowCount === 0, `rowCount=${audDel.rowCount}`);
const audIns = await app.query(`INSERT INTO "AuditEvent" VALUES ('a3','org_1','lead.viewed') RETURNING id`);
check("tenant CAN append its own audit rows", audIns.rowCount === 1);

// --- 7. Pooled connection reuse: switch tenant on the SAME connection --------
await setOrg("org_2");
const afterSwitch = await app.query(`SELECT id FROM "Lead" ORDER BY id`);
check("same pooled connection re-scopes cleanly after tenant switch",
  afterSwitch.rows.length === 1 && afterSwitch.rows[0].id === "l2",
  JSON.stringify(afterSwitch.rows.map(r => r.id)));

// --- 8. RESET must fail closed, not fall back to a previous tenant -----------
await app.query(`RESET app.current_org_id`);
const afterReset = await app.query(`SELECT count(*)::int AS n FROM "Lead"`);
check("RESET returns to deny-all rather than a stale tenant", afterReset.rows[0].n === 0, `saw ${afterReset.rows[0].n}`);

// --- 9. Transaction-scoped setting rolls back --------------------------------
await app.query("BEGIN");
await app.query(`SELECT set_config('app.current_org_id','org_1',true)`); // is_local = true
const inTx = await app.query(`SELECT count(*)::int AS n FROM "Lead"`);
await app.query("COMMIT");
const afterTx = await app.query(`SELECT count(*)::int AS n FROM "Lead"`);
check("transaction-local tenant applies inside and clears after",
  inTx.rows[0].n === 1 && afterTx.rows[0].n === 0,
  `inTx=${inTx.rows[0].n} afterTx=${afterTx.rows[0].n}`);

// --- 10. FORCE is what makes the owner obey ----------------------------------
const forced = await admin.query(`
  SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class
  WHERE relname IN ('Lead','BrokerUser','InteropOutbox','InteropInboundEvent','AuditEvent') ORDER BY relname`);
check("all protected tables have RLS ENABLED and FORCED",
  forced.rows.every(r => r.relrowsecurity && r.relforcerowsecurity),
  forced.rows.map(r => `${r.relname}:${r.relrowsecurity}/${r.relforcerowsecurity}`).join(" "));

// --- 11. Injection through the GUC value -------------------------------------
await app.query(`SELECT set_config('app.current_org_id', $1, false)`, ["org_1' OR '1'='1"]);
const inj = await app.query(`SELECT count(*)::int AS n FROM "Lead"`);
check("SQL-injection-shaped tenant value matches nothing", inj.rows[0].n === 0, `saw ${inj.rows[0].n}`);

await app.end();
await admin.end();

const failed = results.filter(r => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) { console.error("FAILURES:", failed.map(f => f.name)); process.exit(1); }
