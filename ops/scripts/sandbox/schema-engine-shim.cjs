#!/usr/bin/env node
/**
 * Sandbox-only stand-in for the Prisma native `schema-engine` binary.
 *
 * The Prisma CLI downloads a Rust `schema-engine` from binaries.prisma.sh on
 * first use. In network-restricted environments (e.g. the Arena sandbox,
 * where only the npm registry is reachable) that download fails. In Prisma 7
 * the CLI only needs this binary for:
 *   1. a `--version` handshake (verified by `prisma generate`),
 *   2. `cli can-connect-to-database` (connection check),
 *   3. the JSON-RPC `applyMigrations` / `diagnoseMigrationHistory` protocol
 *      used by `prisma migrate deploy` / `prisma migrate status`.
 * Client generation itself runs fully inside the CLI (WASM + JS) in v7.
 *
 * This shim implements (1)-(3) against PostgreSQL using the `pg` driver.
 * It is NOT a general-purpose replacement for the real engine: commands such
 * as createMigration, schemaPush, devDiagnostic and evaluateDataLoss are not
 * supported. `scripts/sandbox/setup-local-db.mjs` installs it ONLY when the
 * real engine cannot be downloaded; on a normal machine the real binary is
 * used and this file is never activated.
 *
 * Installed at the platform engine path inside the pnpm store, e.g.
 *   node_modules/.pnpm/@prisma+engines-at-7.9.1/node_modules/@prisma/engines/schema-engine-debian-openssl-3.0.x
 * (exact directory varies by installed version; setup-local-db.mjs resolves it).
 */
"use strict";

const { createRequire } = require("node:module");
const { randomUUID, createHash } = require("node:crypto");

function loadPg() {
  // The repo has `pg` as a devDependency, so resolution from this file walks
  // up to the repository root node_modules. Fall back to cwd if the shim was
  // copied somewhere else.
  const candidates = [__filename, process.cwd() + "/package.json"];
  for (const base of candidates) {
    try {
      return createRequire(base)("pg");
    } catch {
      // try next
    }
  }
  throw new Error(
    "schema-engine shim: could not resolve the `pg` driver (run `pnpm install` in the repo root)"
  );
}

const pg = loadPg();

// Must match the version pinned by @prisma/engines@7.9.1.
const ENGINE_VERSION = "7.9.0-1.e922089b7d7502aff4249d5da3420f6fa55fc6ad";

const args = process.argv.slice(2);

function parseArg(flag) {
  const i = args.indexOf(flag);
  return i === -1 ? null : args[i + 1];
}

function datasourceUrl() {
  const raw = parseArg("--datasource");
  if (!raw) return null;
  try {
    const obj = JSON.parse(raw);
    return typeof obj === "string" ? obj : (obj.url ?? null);
  } catch {
    return raw;
  }
}

const client = new pg.Client({
  connectionString: datasourceUrl(),
  connectionTimeoutMillis: 8000,
});
let connected = false;
async function withConnection(fn) {
  if (!connected) {
    await client.connect();
    connected = true;
  }
  return fn();
}

const MIGRATIONS_TABLE = `
CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
    "id" TEXT PRIMARY KEY,
    "checksum" TEXT NOT NULL,
    "finished_at" TIMESTAMP(3),
    "logs" TEXT,
    "migration_name" TEXT NOT NULL,
    "rolled_back_at" TIMESTAMP(3),
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT now(),
    "applied_steps_count" INTEGER NOT NULL DEFAULT 0
);`;

function sha256Base64(input) {
  return createHash("sha256").update(input).digest("base64");
}

async function readHistory() {
  const hasTable = await withConnection(async () => {
    const r = await client.query(
      `SELECT to_regclass('_prisma_migrations') IS NOT NULL AS exists`
    );
    return r.rows[0].exists;
  });
  if (!hasTable) return { hasTable, rows: [] };
  const r = await withConnection(() =>
    client.query(
      `SELECT "id","checksum","finished_at","logs","migration_name","rolled_back_at","started_at"
       FROM "_prisma_migrations" ORDER BY "started_at" ASC, "migration_name" ASC`
    )
  );
  return { hasTable, rows: r.rows };
}

async function applyMigrations(params) {
  const dirs =
    (params &&
      params.migrationsList &&
      params.migrationsList.migrationDirectories) ||
    [];
  const { rows } = await readHistory();
  await withConnection(() => client.query(MIGRATIONS_TABLE));
  const appliedNames = new Set(
    rows
      .filter(r => r.finished_at && !r.rolled_back_at)
      .map(r => r.migration_name)
  );
  const failedNames = rows
    .filter(r => !r.finished_at && !r.rolled_back_at)
    .map(r => r.migration_name);
  if (failedNames.length > 0) {
    throw new Error(
      `Error: The migration history contains failed migration(s): ${failedNames.join(", ")}`
    );
  }

  const applied = [];
  for (const dir of dirs) {
    const name = dir.path;
    if (appliedNames.has(name)) continue;
    const file = dir.migrationFile;
    if (!file || file.content.tag !== "ok") {
      throw new Error(
        `Could not read migration file for ${name}: ${file && file.content.value}`
      );
    }
    const sql = file.content.value;
    await withConnection(async () => {
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query(
          `INSERT INTO "_prisma_migrations"
             ("id","checksum","finished_at","logs","migration_name","rolled_back_at","started_at","applied_steps_count")
           VALUES ($1,$2,now(),NULL,$3,NULL,now(),1)`,
          [randomUUID(), sha256Base64(sql), name]
        );
        await client.query("COMMIT");
      } catch (e) {
        await client.query("ROLLBACK");
        throw e;
      }
    });
    applied.push(name);
  }
  return { appliedMigrationNames: applied };
}

async function diagnoseMigrationHistory(params) {
  const dirs = (
    (params &&
      params.migrationsList &&
      params.migrationsList.migrationDirectories) ||
    []
  ).map(d => d.path);
  const { hasTable, rows } = await readHistory();
  if (!hasTable) {
    return {
      hasMigrationsTable: false,
      failedMigrationNames: [],
      history: null,
    };
  }
  const applied = rows
    .filter(r => r.finished_at && !r.rolled_back_at)
    .map(r => r.migration_name);
  const failed = rows
    .filter(r => !r.finished_at && !r.rolled_back_at)
    .map(r => r.migration_name);
  const unpersisted = applied.filter(n => !dirs.includes(n));
  const unapplied = dirs.filter(n => !applied.includes(n));
  let lastCommonMigrationName = null;
  for (const n of dirs) {
    if (applied.includes(n)) lastCommonMigrationName = n;
    else break;
  }
  let diagnostic = "upToDate";
  if (unpersisted.length > 0) diagnostic = "historiesDiverge";
  else if (unapplied.length > 0) diagnostic = "databaseIsBehind";
  return {
    hasMigrationsTable: true,
    failedMigrationNames: failed,
    history: {
      diagnostic,
      unappliedMigrationNames: unapplied,
      unpersistedMigrationNames: unpersisted,
      lastCommonMigrationName,
    },
  };
}

async function handle(request) {
  const { id, method, params } = request;
  try {
    let result;
    switch (method) {
      case "applyMigrations":
        result = await applyMigrations(params);
        break;
      case "diagnoseMigrationHistory":
        result = await diagnoseMigrationHistory(params);
        break;
      case "ensureConnectionValidity":
        await withConnection(() => client.query("select 1"));
        result = {};
        break;
      case "getDatabaseVersion": {
        const r = await withConnection(() => client.query("select version()"));
        result = r.rows[0].version;
        break;
      }
      default:
        return {
          id,
          jsonrpc: "2.0",
          error: {
            code: -32601,
            message: `Method not supported by sandbox shim: ${method}`,
          },
        };
    }
    return { id, jsonrpc: "2.0", result };
  } catch (e) {
    return { id, jsonrpc: "2.0", error: { code: -32000, message: e.message } };
  }
}

async function main() {
  if (args[0] === "--version" || args[0] === "-v") {
    process.stdout.write(ENGINE_VERSION + "\n");
    return;
  }

  if (args.includes("cli")) {
    const sub = args[args.indexOf("cli") + 1];
    if (sub === "can-connect-to-database") {
      try {
        await client.connect();
        await client.query("select 1");
        process.exit(0);
      } catch (e) {
        process.stderr.write(`E connection failed: ${e.message}\n`);
        process.exit(1);
      } finally {
        client.end().catch(() => {});
      }
      process.exit(0);
    }
  }

  // JSON-RPC over stdio (newline-delimited)
  process.stdin.setEncoding("utf8");
  let buffer = "";
  const pending = [];
  let done = false;
  process.stdin.on("data", chunk => {
    buffer += chunk;
    let idx;
    while ((idx = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 1);
      if (line) pending.push(JSON.parse(line));
    }
  });
  process.stdin.on("end", () => {
    done = true;
  });

  for (;;) {
    while (pending.length > 0) {
      const req = pending.shift();
      const res = await handle(req);
      process.stdout.write(JSON.stringify(res) + "\n");
    }
    if (done) break;
    await new Promise(r => setTimeout(r, 25));
  }
  await client.end().catch(() => {});
}

main().catch(e => {
  process.stderr.write(`shim error: ${e.stack || e}\n`);
  process.exit(1);
});
