/* Row-level security audit.
 *
 * RLS has two silent failure modes that no unit test can catch, because both
 * live in the deployed database rather than in the code:
 *
 *   1. The application connects as a superuser or a BYPASSRLS role. Every
 *      policy is then ignored, and the application behaves EXACTLY as if
 *      isolation worked -- until a tenant reads another tenant's data.
 *   2. A table is added later and nobody enables RLS on it. It is wide open,
 *      and again nothing complains.
 *
 * Both are invisible in review and obvious to this script, so it runs in CI and
 * should run against production before enabling the broker channel.
 *
 * Without DATABASE_URL this performs the static half only (that the migration
 * exists and covers the tables it claims), so CI stays green without a
 * database while still catching a deleted or gutted migration.
 */

import { readFileSync, existsSync } from "node:fs";

const MIGRATION = "prisma/migrations/202609030004_row_level_security/migration.sql";

/* Tables holding one tenant's private data. Adding a tenant-owned table
   without adding it here is itself the bug this list prevents. */
const PROTECTED_TABLES = ["Lead", "BrokerUser", "InteropOutbox", "InteropInboundEvent", "AuditEvent"];

const failures = [];
const notes = [];
const ok = [];

function check(condition, message, detail = "") {
  if (condition) ok.push(message);
  else failures.push(detail ? `${message} -- ${detail}` : message);
}

// ---------------------------------------------------------------------------
// Static: the migration exists and says what it must
// ---------------------------------------------------------------------------
if (!existsSync(MIGRATION)) {
  failures.push(`RLS migration is missing: ${MIGRATION}`);
} else {
  const sql = readFileSync(MIGRATION, "utf8");

  check(sql.includes("architech_current_org_id"), "tenant helper function is defined");
  check(
    sql.includes("current_setting('app.current_org_id', true)"),
    "GUC is read with missing_ok=true so an unset tenant denies instead of erroring",
  );
  check(sql.includes("NULLIF"), "empty-string tenant is normalised to NULL");
  /* Inspect the function body, not the whole file: the word IMMUTABLE also
     appears in the migration's explanatory comments, and matching prose would
     make this check meaningless. */
  const helperBody = sql.slice(
    sql.indexOf("CREATE OR REPLACE FUNCTION architech_current_org_id"),
    sql.indexOf("COMMENT ON FUNCTION"),
  );
  check(
    /^\s*STABLE\s*$/m.test(helperBody) && !/^\s*IMMUTABLE\s*$/m.test(helperBody),
    "helper is STABLE, not IMMUTABLE",
    "IMMUTABLE would let the planner cache a tenant across a switch on a pooled connection",
  );

  for (const table of PROTECTED_TABLES) {
    check(
      sql.includes(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`),
      `${table}: RLS enabled`,
    );
    check(
      sql.includes(`ALTER TABLE "${table}" FORCE ROW LEVEL SECURITY`),
      `${table}: RLS forced`,
      "without FORCE the table owner silently bypasses every policy",
    );
  }

  // The audit trail must not be rewritable by the tenant that is being audited.
  check(
    !/CREATE POLICY[^;]*ON "AuditEvent"[^;]*FOR UPDATE/s.test(sql),
    "AuditEvent has no UPDATE policy (append-only)",
  );
  check(
    !/CREATE POLICY[^;]*ON "AuditEvent"[^;]*FOR DELETE/s.test(sql),
    "AuditEvent has no DELETE policy (append-only)",
  );
}

// ---------------------------------------------------------------------------
// Live: what the database actually enforces
// ---------------------------------------------------------------------------
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  notes.push("DATABASE_URL not set -- static checks only. Run against a live database before production.");
} else {
  const { Client } = await import("pg");
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    // 1. The role the application actually uses.
    const role = await client.query(
      `SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user`,
    );
    const { rolsuper, rolbypassrls } = role.rows[0] ?? {};
    check(rolsuper === false, "application role is not a superuser",
      "a superuser ignores every RLS policy");
    check(rolbypassrls === false, "application role does not hold BYPASSRLS",
      "BYPASSRLS ignores every RLS policy");

    // 2. Every protected table is enabled AND forced.
    const tables = await client.query(
      `SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity
         FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = ANY($1)`,
      [PROTECTED_TABLES],
    );
    const found = new Map(tables.rows.map((r) => [r.relname, r]));
    for (const table of PROTECTED_TABLES) {
      const row = found.get(table);
      if (!row) {
        failures.push(`${table}: table not found in the database`);
        continue;
      }
      check(row.relrowsecurity === true, `${table}: RLS is live`);
      check(row.relforcerowsecurity === true, `${table}: RLS is forced`);
    }

    // 3. Fail-closed behaviour, proven rather than assumed.
    await client.query(`SELECT set_config('app.current_org_id', '', true)`);
    for (const table of PROTECTED_TABLES) {
      if (!found.has(table)) continue;
      const { rows } = await client.query(`SELECT count(*)::int AS n FROM "${table}"`);
      check(rows[0].n === 0, `${table}: unscoped connection reads 0 rows`, `read ${rows[0].n}`);
    }
  } finally {
    await client.end();
  }
}

// ---------------------------------------------------------------------------
for (const line of ok) console.log(`  ok    ${line}`);
for (const line of notes) console.log(`  note  ${line}`);
for (const line of failures) console.error(`  FAIL  ${line}`);

console.log(`\nrls-audit: ${ok.length} passed, ${failures.length} failed${notes.length ? `, ${notes.length} note(s)` : ""}`);
if (failures.length > 0) process.exit(1);
